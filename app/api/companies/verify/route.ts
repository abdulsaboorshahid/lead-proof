import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateScore, calculateEvidenceLevel, detectConflicts } from "@/lib/scoring";
import { generateDummyData } from "@/lib/dummy-data";

export async function POST(request: NextRequest) {
  try {
    const companies = await db.companies.findAll();

    if (companies.length === 0) {
      return NextResponse.json(
        { error: "No companies to verify. Please import companies first." },
        { status: 400 }
      );
    }

    const dummyData = generateDummyData();
    const verifications = [];

    for (const company of companies) {
      // Simulate processing delay so the UI's progress bar isn't instant
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Companies without a matching dummy record fall through to the
      // "not found" branch below rather than being skipped.
      const dummyMatch = dummyData.find(
        (d) => d.domain === company.domain
      );

      if (dummyMatch) {
        // Dummy fixtures are hand-authored as already-confirmed data (no
        // real scraped page to quote-check against), so every present
        // field is marked verified. This has to happen BEFORE scoring —
        // calculateScore/calculateEvidenceLevel/detectConflicts all key
        // off the *Verified flags, not just presence, so they need an
        // object that already has them, not the raw fixture.
        const verification = {
          ...dummyMatch.verification,
          ownerVerified: !!dummyMatch.verification.ownerName,
          foundingVerified: !!dummyMatch.verification.foundingYear,
          locationVerified: dummyMatch.verification.locationCount !== undefined && dummyMatch.verification.locationCount !== null,
          teamSizeVerified: !!dummyMatch.verification.teamSize,
          phoneVerified: !!dummyMatch.verification.phone,
          emailVerified: !!dummyMatch.verification.email,
        };

        const conflicts = detectConflicts(verification, {
          owner: company.importedOwner,
          employees: company.importedEmployees,
          revenue: company.importedRevenue,
          phone: company.importedPhone,
        });
        const evidence = calculateEvidenceLevel(verification);
        const { score } = calculateScore(verification, company.importedEmployees);

        const result = await db.verificationResults.create({
          companyId: company.id,
          ownerName: verification.ownerName || null,
          ownerQuote: verification.ownerQuote || null,
          ownerSource: verification.ownerSource || null,
          ownerVerified: verification.ownerVerified,
          foundingYear: verification.foundingYear || null,
          foundingQuote: verification.foundingQuote || null,
          foundingSource: verification.foundingSource || null,
          foundingVerified: verification.foundingVerified,
          locationCount: verification.locationCount || null,
          locationQuote: verification.locationQuote || null,
          locationSource: verification.locationSource || null,
          locationVerified: verification.locationVerified,
          teamSize: verification.teamSize || null,
          teamSizeQuote: verification.teamSizeQuote || null,
          teamSizeSource: verification.teamSizeSource || null,
          teamSizeVerified: verification.teamSizeVerified,
          phone: verification.phone || null,
          phoneQuote: verification.phoneQuote || null,
          phoneSource: verification.phoneSource || null,
          phoneVerified: verification.phoneVerified,
          email: verification.email || null,
          emailVerified: verification.emailVerified,
          emailSource: verification.emailSource || null,
          fitScore: score,
          evidenceLevel: evidence.level,
          evidenceCount: evidence.count,
          conflicts: conflicts.length > 0 ? conflicts : null,
          callBrief: verification.callBrief || null,
          processingTimeMs: Math.floor(Math.random() * 2000) + 500,
        });

        verifications.push(result);
      } else {
        // No dummy record for this domain — every field reports "not found".
        const evidence = calculateEvidenceLevel({});
        const { score } = calculateScore({}, company.importedEmployees);

        const result = await db.verificationResults.create({
          companyId: company.id,
          ownerName: null,
          ownerQuote: null,
          ownerSource: null,
          ownerVerified: false,
          foundingYear: null,
          foundingQuote: null,
          foundingSource: null,
          foundingVerified: false,
          locationCount: null,
          locationQuote: null,
          locationSource: null,
          locationVerified: false,
          teamSize: null,
          teamSizeQuote: null,
          teamSizeSource: null,
          teamSizeVerified: false,
          phone: null,
          phoneQuote: null,
          phoneSource: null,
          phoneVerified: false,
          email: null,
          emailVerified: false,
          emailSource: null,
          fitScore: score,
          evidenceLevel: evidence.level,
          evidenceCount: evidence.count,
          conflicts: null,
          callBrief: `No verification data found for ${company.name}. Website may be unavailable or contain minimal information.`,
          processingTimeMs: Math.floor(Math.random() * 1000) + 300,
        });

        verifications.push(result);
      }
    }

    return NextResponse.json({
      success: true,
      verified: verifications.length,
      verifications,
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      {
        error: "Failed to verify companies",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
