// Web scraping utilities with robots.txt compliance
import * as cheerio from "cheerio";

export interface ScrapedContent {
  url: string;
  title: string;
  textContent: string;
  html: string;
  links: string[];
  success: boolean;
  error?: string;
}

/**
 * Fetch and parse a webpage
 */
export async function scrapeWebpage(url: string): Promise<ScrapedContent> {
  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;

    const response = await fetch(fullUrl, {
      headers: {
        // The User-Agent stays honestly self-identifying — these are just
        // the standard headers a normal HTTP client sends, so a naive
        // "does this request even look like a real request" filter (e.g.
        // a check for a missing Accept header) doesn't reject us outright.
        // This does nothing against fingerprint-based bot management
        // (Akamai, Cloudflare) — see the 401/403/429/503 handling below.
        "User-Agent": "Caprae Lead Verifier Bot/1.0 (Acquisition Research Tool)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      // 401/403/429/503 usually mean a WAF or bot-detection service (Akamai,
      // Cloudflare, etc.) is blocking our honestly-self-identifying bot
      // User-Agent — not that the site is actually down. Per the project's
      // own scope, we don't spoof a browser UA to get past that; we just
      // say so clearly instead of the misleading "unreachable".
      const likelyBotBlock = [401, 403, 429, 503].includes(response.status);
      const message = likelyBotBlock
        ? `Blocked by the site's bot/traffic protection (HTTP ${response.status}) — the site itself may be fine, it's just not allowing automated requests`
        : `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, noscript").remove();

    const textContent = $("body").text().replace(/\s+/g, " ").trim();
    const title = $("title").text() || $("h1").first().text() || "";

    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        links.push(href);
      }
    });

    return {
      url: fullUrl,
      title,
      textContent,
      html,
      links,
      success: true,
    };
  } catch (error) {
    return {
      url,
      title: "",
      textContent: "",
      html: "",
      links: [],
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Scrape multiple pages from a website
 */
export async function scrapeCompanyWebsite(domain: string): Promise<{
  homepage: ScrapedContent;
  aboutPage?: ScrapedContent;
  contactPage?: ScrapedContent;
  combinedContent: string;
}> {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const homepage = await scrapeWebpage(baseUrl);

  if (!homepage.success) {
    return {
      homepage,
      combinedContent: "",
    };
  }

  const aboutUrls = homepage.links.filter((link) =>
    /about|who-we-are|our-story|company/i.test(link)
  );
  const contactUrls = homepage.links.filter((link) =>
    /contact|reach-us|get-in-touch/i.test(link)
  );

  // Polite delay before each follow-up request to the same site
  let aboutPage: ScrapedContent | undefined;
  if (aboutUrls.length > 0) {
    const aboutUrl = new URL(aboutUrls[0], baseUrl).href;
    aboutPage = await scrapeWebpage(aboutUrl);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  let contactPage: ScrapedContent | undefined;
  if (contactUrls.length > 0) {
    const contactUrl = new URL(contactUrls[0], baseUrl).href;
    contactPage = await scrapeWebpage(contactUrl);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const combinedContent = [
    homepage.textContent,
    aboutPage?.textContent || "",
    contactPage?.textContent || "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 50000); // Keep the extraction prompt a reasonable size

  return {
    homepage,
    aboutPage,
    contactPage,
    combinedContent,
  };
}

/**
 * Check robots.txt compliance
 */
export async function checkRobotsTxt(domain: string, userAgent: string = "*"): Promise<{
  allowed: boolean;
  crawlDelay?: number;
}> {
  try {
    const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
    const robotsUrl = new URL("/robots.txt", baseUrl).href;

    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // No robots.txt, assume allowed
      return { allowed: true };
    }

    const robotsTxt = await response.text();
    const lines = robotsTxt.split("\n");

    let currentUserAgent = "";
    let disallowPaths: string[] = [];
    let crawlDelay: number | undefined;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith("user-agent:")) {
        currentUserAgent = trimmed.split(":")[1].trim();
      } else if (
        (currentUserAgent === "*" || currentUserAgent === userAgent.toLowerCase()) &&
        trimmed.startsWith("disallow:")
      ) {
        const path = trimmed.split(":")[1].trim();
        if (path) disallowPaths.push(path);
      } else if (
        (currentUserAgent === "*" || currentUserAgent === userAgent.toLowerCase()) &&
        trimmed.startsWith("crawl-delay:")
      ) {
        const delay = trimmed.split(":")[1].trim();
        crawlDelay = parseInt(delay);
      }
    }

    // Check if root path is disallowed
    const allowed = !disallowPaths.includes("/");

    return { allowed, crawlDelay };
  } catch (error) {
    // If robots.txt check fails, assume allowed
    return { allowed: true };
  }
}
