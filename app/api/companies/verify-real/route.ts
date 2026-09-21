import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Company, NewVerificationResult } from "@/lib/db/schema";
import { scrapeCompanyWebsite, checkRobotsTxt } from "@/lib/web-scraper";
import { verifyWithAI, calculateAuthenticityScore } from "@/lib/ai-verification";
import { calculateScore, calculateEvidenceLevel, detectConflicts } from "@/lib/scoring";

// How many companies to verify at once. Each company is (almost always) a
// different domain, so there's no politeness reason to serialize across
// companies — only within a single domain's own requests, which still run
// sequentially inside verifyOneCompany/scrapeCompanyWebsite. This is capped
// rather than unbounded to stay within OpenRouter rate limits and keep the
// server's own outbound connection count reasonable. Most bot-blocked/dead
// sites fail at the scrape step in well under a second without ever
// reaching OpenRouter, so raising this mainly speeds up that majority
// case rather than adding much extra AI-call pressure.
const VERIFY_CONCURRENCY = 8;

// Ceiling on how long we'll honor a robots.txt Crawl-delay directive for.
// See the comment where this is used in verifyOneCompany for why.
const MAX_CRAWL_DELAY_SECONDS = 5;

// Runs `worker` over `items` with at most `limit` in flight at once,
// returning results in the same order as `items` regardless of completion
// order.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, run)
  );

  return results;
}

type VerifyOutcome = {
  log: string[];
  result: Awaited<ReturnType<typeof db.verificationResults.create>> | null;
};

async function verifyOneCompany(company: Company): Promise<VerifyOutcome> {
  const log: string[] = [];
  const t0 = Date.now();
  const elapsed = () => Date.now() - t0;

  const emptyFields = {
    ownerName: null, ownerQuote: null, ownerSource: null, ownerVerified: false,
    foundingYear: null, foundingQuote: null, foundingSource: null, foundingVerified: false,
    locationCount: null, locationQuote: null, locationSource: null, locationVerified: false,
    teamSize: null, teamSizeQuote: null, teamSizeSource: null, teamSizeVerified: false,
    phone: null, phoneQuote: null, phoneSource: null, phoneVerified: false,
    email: null, emailVerified: false, emailSource: null,
  } satisfies Partial<NewVerificationResult>;

  try {
    log.push(`[+${elapsed()}ms] Processing ${company.name}...`);

    const robotsCheck = await checkRobotsTxt(company.domain);
    if (!robotsCheck.allowed) {
      log.push(`[+${elapsed()}ms] ⚠️ ${company.name}: Blocked by robots.txt`);

      const evidence = calculateEvidenceLevel({});
      const { score } = calculateScore({}, company.importedEmployees);

      const result = await db.verificationResults.create({
        companyId: company.id,
        ...emptyFields,
        fitScore: score,
        evidenceLevel: evidence.level,
        evidenceCount: evidence.count,
        conflicts: null,
        callBrief: `Verification blocked by robots.txt for ${company.name}.`,
        processingTimeMs: elapsed(),
      });
      return { log, result };
    }

    // This crawl-delay is specific to company.domain and doesn't affect
    // other companies running concurrently in other workers — but a batch
    // only finishes once every company has, so one outlier directive still
    // sets a floor on the whole batch's wall-clock time. Confirmed live:
    // press.pace.edu's robots.txt specifies Crawl-delay: 30, and honoring
    // it in full made that one company take 34s out of a 37.5s batch.
    // Crawl-delay exists to space out a *sustained* crawl of many pages on
    // the same site; we visit each site once (a handful of page fetches,
    // already spaced 1s apart within that single visit — see
    // scrapeCompanyWebsite), so honoring an outlier 30s value here doesn't
    // serve the directive's actual purpose, just stalls the batch. Still
    // respecting the site's intent (waiting, being non-zero) with a cap
    // rather than ignoring it outright.
    const crawlDelay = robotsCheck.crawlDelay
      ? Math.min(robotsCheck.crawlDelay, MAX_CRAWL_DELAY_SECONDS)
      : 0;
    if (crawlDelay > 0) {
      log.push(`[+${elapsed()}ms] robots.txt crawl-delay: waiting ${crawlDelay}s${crawlDelay < robotsCheck.crawlDelay! ? ` (capped from ${robotsCheck.crawlDelay}s)` : ""}`);
      await new Promise((resolve) => setTimeout(resolve, crawlDelay * 1000));
    }

    log.push(`[+${elapsed()}ms] 📡 Scraping ${company.domain}...`);
    const scraped = await scrapeCompanyWebsite(company.domain);
    log.push(`[+${elapsed()}ms] Scrape finished (success=${scraped.homepage.success})`);

    if (!scraped.homepage.success) {
      log.push(`[+${elapsed()}ms] ❌ ${company.name}: Failed to scrape (${scraped.homepage.error})`);

      const evidence = calculateEvidenceLevel({});
      const { score } = calculateScore({}, company.importedEmployees);

      const result = await db.verificationResults.create({
        companyId: company.id,
        ...emptyFields,
        fitScore: score,
        evidenceLevel: evidence.level,
        evidenceCount: evidence.count,
        conflicts: null,
        callBrief: `Could not verify ${company.name} automatically: ${scraped.homepage.error}`,
        processingTimeMs: elapsed(),
      });
      return { log, result };
    }

    log.push(`[+${elapsed()}ms] 🤖 Extracting facts with OpenRouter...`);
    const aiResult = await verifyWithAI({
      companyName: company.name,
      domain: company.domain,
      websiteContent: scraped.combinedContent,
      importedData: {
        owner: company.importedOwner || undefined,
        employees: company.importedEmployees || undefined,
        revenue: company.importedRevenue || undefined,
      },
    });

    log.push(`[+${elapsed()}ms] ✓ Verifying quote authenticity...`);
    const authenticityCheck = calculateAuthenticityScore(
      aiResult,
      scraped.combinedContent
    );

    // NOTE: this only logs a warning — aiResult below is saved as-is
    // even when authenticityCheck.score is low. Quotes that failed the
    // authenticity check are not actually dropped despite this message.
    if (authenticityCheck.score < 50) {
      log.push(`⚠️ ${company.name}: Low authenticity score (${authenticityCheck.score}%), discarding results`);
    }

    // Merge the authenticity breakdown into aiResult BEFORE scoring —
    // calculateScore/calculateEvidenceLevel/detectConflicts all key off
    // the *Verified flags, not just presence, so they need an object that
    // already has them. aiResult alone (from verifyWithAI) has no
    // ownerVerified/foundingVerified/etc. fields of its own — those only
    // exist as authenticityCheck.breakdown.*Authentic until merged here.
    const verifiedResult = {
      ...aiResult,
      ownerVerified: authenticityCheck.breakdown.ownerAuthentic,
      foundingVerified: authenticityCheck.breakdown.foundingAuthentic,
      locationVerified: authenticityCheck.breakdown.locationAuthentic,
      teamSizeVerified: authenticityCheck.breakdown.teamSizeAuthentic,
      phoneVerified: authenticityCheck.breakdown.phoneAuthentic,
      emailVerified: authenticityCheck.breakdown.emailAuthentic,
    };

    const conflicts = detectConflicts(verifiedResult, {
      owner: company.importedOwner,
      employees: company.importedEmployees,
      revenue: company.importedRevenue,
      phone: company.importedPhone,
    });
    const evidence = calculateEvidenceLevel(verifiedResult);
    const { score } = calculateScore(verifiedResult, company.importedEmployees);
    const callBrief = generateCallBrief(company, aiResult, conflicts, authenticityCheck.score);

    const result = await db.verificationResults.create({
      companyId: company.id,
      ownerName: aiResult.ownerName || null,
      ownerQuote: aiResult.ownerQuote || null,
      ownerSource: scraped.homepage.url,
      ownerVerified: verifiedResult.ownerVerified,
      foundingYear: aiResult.foundingYear || null,
      foundingQuote: aiResult.foundingQuote || null,
      foundingSource: scraped.homepage.url,
      foundingVerified: verifiedResult.foundingVerified,
      locationCount: aiResult.locationCount || null,
      locationQuote: aiResult.locationQuote || null,
      locationSource: scraped.homepage.url,
      locationVerified: verifiedResult.locationVerified,
      teamSize: aiResult.teamSize || null,
      teamSizeQuote: aiResult.teamSizeQuote || null,
      teamSizeSource: scraped.homepage.url,
      teamSizeVerified: verifiedResult.teamSizeVerified,
      phone: aiResult.phone || null,
      phoneQuote: aiResult.phoneQuote || null,
      phoneSource: scraped.homepage.url,
      phoneVerified: verifiedResult.phoneVerified,
      email: aiResult.email || null,
      emailVerified: verifiedResult.emailVerified,
      emailSource: scraped.homepage.url,
      fitScore: score,
      evidenceLevel: evidence.level,
      evidenceCount: evidence.count,
      conflicts: conflicts.length > 0 ? conflicts : null,
      callBrief,
      processingTimeMs: elapsed(),
    });

    log.push(`[+${elapsed()}ms] ✅ ${company.name}: Verified (score: ${score}, authenticity: ${authenticityCheck.score.toFixed(0)}%)`);
    return { log, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.push(`[+${elapsed()}ms] ❌ ${company.name}: Error - ${message}`);
    console.error(`Error processing ${company.name}:`, error);

    // Always record an outcome, even on an unexpected error — otherwise
    // this company silently has zero verification rows and its evidence
    // panel renders nothing at all, with no indication anything went
    // wrong for it specifically.
    try {
      const evidence = calculateEvidenceLevel({});
      const { score } = calculateScore({}, company.importedEmployees);
      const result = await db.verificationResults.create({
        companyId: company.id,
        ...emptyFields,
        fitScore: score,
        evidenceLevel: evidence.level,
        evidenceCount: evidence.count,
        conflicts: null,
        callBrief: `Could not verify ${company.name} automatically: ${message}`,
        processingTimeMs: elapsed(),
      });
      return { log, result };
    } catch (dbError) {
      console.error(`Failed to record error outcome for ${company.name}:`, dbError);
      return { log, result: null };
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const companies = await db.companies.findAll();

    if (companies.length === 0) {
      return NextResponse.json(
        { error: "No companies to verify. Please import companies first." },
        { status: 400 }
      );
    }

    if (!process.env.OPEN_ROUTER_API_KEY) {
      return NextResponse.json(
        {
          error: "OpenRouter API not configured",
          details: "Please set OPEN_ROUTER_API_KEY environment variable to use real verification"
        },
        { status: 400 }
      );
    }

    const outcomes = await mapWithConcurrency(companies, VERIFY_CONCURRENCY, verifyOneCompany);

    const verifications = outcomes.flatMap((o) => (o.result ? [o.result] : []));
    // Logs are per-company blocks kept in original list order (not
    // completion order) even though the underlying work interleaves.
    const processingLog = outcomes.flatMap((o) => o.log);

    return NextResponse.json({
      success: true,
      verified: verifications.length,
      verifications,
      log: processingLog,
    });
  } catch (error) {
    console.error("Real verification error:", error);
    return NextResponse.json(
      {
        error: "Failed to verify companies with OpenRouter",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function generateCallBrief(
  company: any,
  verification: any,
  conflicts: string[],
  authenticityScore: number
): string {
  const parts: string[] = [];

  if (verification.ownerName) {
    parts.push(`${verification.ownerName} owns ${company.name}`);
  } else {
    parts.push(`${company.name}`);
  }

  if (verification.foundingYear) {
    const age = new Date().getFullYear() - verification.foundingYear;
    parts.push(`established ${verification.foundingYear} (${age} years)`);
  }

  if (verification.locationCount !== null && verification.locationCount !== undefined) {
    parts.push(`${verification.locationCount} location${verification.locationCount !== 1 ? "s" : ""}`);
  }

  if (verification.teamSize) {
    parts.push(`${verification.teamSize} employees`);
  }

  if (conflicts.length > 0) {
    parts.push(`Note: ${conflicts.length} data conflict${conflicts.length !== 1 ? "s" : ""} detected`);
  }

  parts.push(`Authenticity: ${authenticityScore.toFixed(0)}%`);

  return parts.join(". ") + ".";
}
