// Fact verification against scraped website content, via OpenRouter
// (OpenAI-compatible API — https://openrouter.ai/docs)
import OpenAI from "openai";
import { normalizePhone } from "./deduplication";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
// OpenRouter model ids are provider-prefixed.
const VERIFICATION_MODEL = "openai/gpt-5.4-mini";

// 408/429/5xx are always worth retrying — genuinely transient.
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

// OpenRouter returns 402 for two very different situations with the same
// status code:
//  - "would exceed your available credits given your current in-flight
//    requests" — transient, caused by several concurrent calls each
//    reserving credit at once; resolves once other in-flight requests
//    settle, so retrying after a short delay helps.
//  - "requires more credits... you requested up to N tokens but can only
//    afford M" — the account's balance is actually too low. This will
//    NEVER succeed by retrying (nothing about waiting adds credits), so
//    retrying it is pure wasted time — confirmed live: 14 of 23 companies
//    hit this in one run, each burning ~4.5s of backoff for a guaranteed
//    failure, which was the actual majority of that run's wall-clock time.
function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status && RETRYABLE_STATUSES.has(status)) return true;
  if (status === 402) {
    const message = error instanceof Error ? error.message : "";
    return /in-flight/i.test(message);
  }
  return false;
}

// "This request requires more credits... you requested up to 2000 tokens,
// but can only afford 1748" — OpenRouter tells us exactly how much we can
// spend right now. Rather than failing outright (or blindly retrying the
// same request, which would just fail again), retry once at a budget that
// actually fits.
function getAffordableTokenBudget(error: unknown): number | null {
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/can only afford (\d+)/i);
  if (!match) return null;
  const affordable = parseInt(match[1], 10);
  // Small safety margin — the balance can shift slightly between the error
  // and the retry if other requests are also in flight.
  const budget = affordable - 50;
  return budget > 0 ? budget : null;
}

async function createChatCompletionWithRetry(
  client: OpenAI,
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: unknown;
  let currentParams = params;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await client.chat.completions.create(currentParams);
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      if (isLastAttempt) throw error;

      const affordableBudget = getAffordableTokenBudget(error);
      if (affordableBudget !== null) {
        // Adjust and retry immediately — no backoff needed, the balance
        // isn't going to change just by waiting.
        currentParams = { ...currentParams, max_tokens: affordableBudget };
        continue;
      }

      if (!isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }

  throw lastError;
}

export interface VerificationInput {
  companyName: string;
  domain: string;
  websiteContent: string;
  importedData?: {
    owner?: string;
    employees?: number;
    revenue?: number;
  };
}

export interface ExtractedFact {
  field: string;
  value: string | number | null;
  quote: string | null;
  source: string;
  confidence: "high" | "medium" | "low";
}

export interface AIVerificationResult {
  ownerName?: string;
  ownerQuote?: string;
  ownerConfidence?: "high" | "medium" | "low";
  
  foundingYear?: number;
  foundingQuote?: string;
  foundingConfidence?: "high" | "medium" | "low";
  
  locationCount?: number;
  locationQuote?: string;
  locationConfidence?: "high" | "medium" | "low";
  
  teamSize?: number;
  teamSizeQuote?: string;
  teamSizeConfidence?: "high" | "medium" | "low";
  
  phone?: string;
  phoneQuote?: string;
  
  email?: string;
  emailQuote?: string;
  
  facts: ExtractedFact[];
}

/**
 * Verify company facts via OpenRouter (OpenAI-compatible chat completions API)
 * This function extracts structured information from website content
 */
export async function verifyWithAI(
  input: VerificationInput
): Promise<AIVerificationResult> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY not configured");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      // OpenRouter's optional attribution headers (for their leaderboards),
      // not auth-related.
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Caprae Lead Verifier",
    },
  });

  const prompt = `You are a precise fact extraction assistant. Analyze the following website content and extract ONLY facts that are explicitly stated. Never infer or guess.

Company Name: ${input.companyName}
Domain: ${input.domain}

Website Content:
${input.websiteContent}

${input.importedData ? `
Imported Data (for comparison):
- Owner: ${input.importedData.owner || "N/A"}
- Employees: ${input.importedData.employees || "N/A"}
- Revenue: ${input.importedData.revenue || "N/A"}
` : ""}

Extract the following information. For each field:
1. Find the EXACT quote from the website that supports the fact
2. Rate your confidence (high/medium/low)
3. If not found, return null

Return JSON with this structure:
{
  "ownerName": "exact name or null",
  "ownerQuote": "exact quote containing the name",
  "ownerConfidence": "high|medium|low",
  
  "foundingYear": number or null,
  "foundingQuote": "exact quote about founding",
  "foundingConfidence": "high|medium|low",
  
  "locationCount": number or null,
  "locationQuote": "exact quote about locations",
  "locationConfidence": "high|medium|low",
  
  "teamSize": number or null,
  "teamSizeQuote": "exact quote about team/employees",
  "teamSizeConfidence": "high|medium|low",
  
  "phone": "phone number or null",
  "phoneQuote": "exact quote containing phone",
  
  "email": "email address or null",
  "emailQuote": "exact quote or context for email"
}

Rules:
- Only extract facts EXPLICITLY stated in the content
- Quotes must be verbatim from the website
- Be conservative - if uncertain, mark confidence as low or return null
- For owner, look for "founder", "owner", "CEO", "president"
- For team size, look for employee count, staff count, team size
- For locations, count physical addresses or explicit mentions of multiple locations`;

  try {
    // Retries transient/capacity errors (429, 5xx, and the "in-flight
    // requests" flavor of 402 — several concurrent calls each reserving
    // credit at once, see VERIFY_CONCURRENCY in verify-real/route.ts) and
    // adapts to the "insufficient balance" flavor of 402 by retrying once
    // at whatever budget OpenRouter says is actually affordable.
    const response = await createChatCompletionWithRetry(client, {
      model: VERIFICATION_MODEL,
      temperature: 0,
      // The response is 6 short fields (value + quote + confidence each);
      // 900 tokens is generous for that and far less likely to exceed a
      // tight account balance than the original 2000.
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenRouter");
    }

    // Parse the model's JSON response
    const extracted = JSON.parse(content);

    return {
      ownerName: extracted.ownerName || undefined,
      ownerQuote: extracted.ownerQuote || undefined,
      ownerConfidence: extracted.ownerConfidence || undefined,
      
      foundingYear: extracted.foundingYear || undefined,
      foundingQuote: extracted.foundingQuote || undefined,
      foundingConfidence: extracted.foundingConfidence || undefined,
      
      locationCount: extracted.locationCount || undefined,
      locationQuote: extracted.locationQuote || undefined,
      locationConfidence: extracted.locationConfidence || undefined,
      
      teamSize: extracted.teamSize || undefined,
      teamSizeQuote: extracted.teamSizeQuote || undefined,
      teamSizeConfidence: extracted.teamSizeConfidence || undefined,
      
      phone: extracted.phone || undefined,
      phoneQuote: extracted.phoneQuote || undefined,
      
      email: extracted.email || undefined,
      emailQuote: extracted.emailQuote || undefined,
      
      facts: [],
    };
  } catch (error) {
    console.error("OpenRouter verification error:", error);
    throw error;
  }
}

/**
 * Verify that an extracted VALUE (a phone number, an email, a name, a
 * year, a count) actually appears in the source content — as opposed to
 * matching the AI's full quote sentence. Matching the underlying data
 * point is far more forgiving than matching exact phrasing: the AI can
 * paraphrase, reorder, or lightly reformat the surrounding sentence
 * without the fact itself being any less real, so quote-level matching
 * produced false "unverified" results for facts that were genuinely on
 * the page.
 */
function verifyValueAuthenticity(
  value: string,
  sourceContent: string,
  kind: "text" | "digits" | "number" = "text"
): boolean {
  if (!value || !sourceContent) return false;

  if (kind === "digits") {
    // Phone numbers: compare digit streams so "(555) 999-9999" and
    // "555.999.9999" are the same fact regardless of formatting.
    const valueDigits = normalizePhone(value);
    const contentDigits = sourceContent.replace(/\D/g, "");
    return valueDigits.length === 10 && contentDigits.includes(valueDigits);
  }

  if (kind === "number") {
    // Founding year, team size, location count: match as a whole number
    // so "12" doesn't match inside "120" or "2012". Strips thousands
    // separators from the page first, so "5,500 employees" matches "5500".
    const contentNoThousandsSeparators = sourceContent.replace(/(\d),(?=\d{3}\b)/g, "$1");
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<!\\d)${escaped}(?!\\d)`).test(contentNoThousandsSeparators);
  }

  // Owner name, email: case-insensitive substring match of the value
  // itself, ignoring whitespace differences.
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return normalize(sourceContent).includes(normalize(value));
}

/**
 * Calculate authenticity score for verification results
 */
export function calculateAuthenticityScore(
  verification: AIVerificationResult,
  sourceContent: string
): {
  score: number;
  breakdown: {
    ownerAuthentic: boolean;
    foundingAuthentic: boolean;
    locationAuthentic: boolean;
    teamSizeAuthentic: boolean;
    phoneAuthentic: boolean;
    emailAuthentic: boolean;
  };
} {
  const breakdown = {
    ownerAuthentic: false,
    foundingAuthentic: false,
    locationAuthentic: false,
    teamSizeAuthentic: false,
    phoneAuthentic: false,
    emailAuthentic: false,
  };

  let totalChecks = 0;
  let passedChecks = 0;

  // Each check matches the actual extracted value against the page —
  // not the AI's full quote sentence, which is much stricter than
  // necessary: the AI can paraphrase the surrounding sentence while the
  // fact itself is still genuinely on the page.

  if (verification.ownerName) {
    totalChecks++;
    if (verifyValueAuthenticity(verification.ownerName, sourceContent, "text")) {
      passedChecks++;
      breakdown.ownerAuthentic = true;
    }
  }

  if (verification.foundingYear) {
    totalChecks++;
    if (verifyValueAuthenticity(String(verification.foundingYear), sourceContent, "number")) {
      passedChecks++;
      breakdown.foundingAuthentic = true;
    }
  }

  if (verification.locationCount !== undefined && verification.locationCount !== null) {
    totalChecks++;
    if (verifyValueAuthenticity(String(verification.locationCount), sourceContent, "number")) {
      passedChecks++;
      breakdown.locationAuthentic = true;
    }
  }

  if (verification.teamSize) {
    totalChecks++;
    if (verifyValueAuthenticity(String(verification.teamSize), sourceContent, "number")) {
      passedChecks++;
      breakdown.teamSizeAuthentic = true;
    }
  }

  if (verification.phone) {
    totalChecks++;
    if (verifyValueAuthenticity(verification.phone, sourceContent, "digits")) {
      passedChecks++;
      breakdown.phoneAuthentic = true;
    }
  }

  if (verification.email) {
    totalChecks++;
    if (verifyValueAuthenticity(verification.email, sourceContent, "text")) {
      passedChecks++;
      breakdown.emailAuthentic = true;
    }
  }

  const score = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

  return { score, breakdown };
}
