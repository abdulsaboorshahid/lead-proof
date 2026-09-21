import { VerificationResult } from "./db/schema";
import { normalizePhone } from "./deduplication";

export interface ScoreBreakdown {
  ownerOperated: number;
  yearsInBusiness: number;
  locationFit: number;
  sizeFit: number;
  reachability: number;
  dataConsistency: number;
  total: number;
}

export interface EvidenceBreakdown {
  hasOwner: boolean;
  hasFoundingYear: boolean;
  hasLocationCount: boolean;
  hasTeamSize: boolean;
  hasPhone: boolean;
  hasVerifiedEmail: boolean;
  count: number;
  level: "high" | "medium" | "low";
}

const WEIGHTS = {
  ownerOperated: 25,
  yearsInBusiness: 20,
  locationFit: 20,
  sizeFit: 15,
  reachability: 10,
  dataConsistency: 10,
};

const TARGET_TEAM_SIZE = { min: 5, max: 50, ideal: 15 };
const IDEAL_YEARS_MIN = 5;
const IDEAL_YEARS_MAX = 25;

export function calculateScore(
  verification: Partial<VerificationResult>,
  importedEmployees?: number | null
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    ownerOperated: 0,
    yearsInBusiness: 0,
    locationFit: 0,
    sizeFit: 0,
    reachability: 0,
    dataConsistency: 0,
    total: 0,
  };

  // Every signal below requires the matching *Verified flag, not just a
  // present value — an AI-extracted fact whose quote couldn't be matched
  // on the page (see verifyValueAuthenticity) earns zero points here,
  // same as a fact that was never found at all. A value the AI returned
  // but couldn't confirm shouldn't score any differently than "not found".

  // 1. Owner-operated (25 points)
  if (verification.ownerName && verification.ownerVerified) {
    breakdown.ownerOperated = WEIGHTS.ownerOperated;
  }

  // 2. Years in business (20 points)
  if (verification.foundingYear && verification.foundingVerified) {
    const yearsInBusiness = new Date().getFullYear() - verification.foundingYear;
    if (yearsInBusiness >= IDEAL_YEARS_MIN) {
      const ratio = Math.min(yearsInBusiness, IDEAL_YEARS_MAX) / IDEAL_YEARS_MAX;
      breakdown.yearsInBusiness = Math.round(WEIGHTS.yearsInBusiness * ratio);
    }
  }

  // 3. Single or few locations (20 points)
  if (
    verification.locationCount !== undefined &&
    verification.locationCount !== null &&
    verification.locationVerified
  ) {
    if (verification.locationCount === 1) {
      breakdown.locationFit = WEIGHTS.locationFit;
    } else if (verification.locationCount === 2) {
      breakdown.locationFit = Math.round(WEIGHTS.locationFit * 0.5);
    }
    // 3+ locations get 0 points
  }

  // 4. Size fit (15 points)
  if (verification.teamSize && verification.teamSizeVerified) {
    if (
      verification.teamSize >= TARGET_TEAM_SIZE.min &&
      verification.teamSize <= TARGET_TEAM_SIZE.max
    ) {
      const distanceFromIdeal = Math.abs(verification.teamSize - TARGET_TEAM_SIZE.ideal);
      const maxDistance = TARGET_TEAM_SIZE.max - TARGET_TEAM_SIZE.ideal;
      const ratio = 1 - distanceFromIdeal / maxDistance;
      breakdown.sizeFit = Math.round(WEIGHTS.sizeFit * Math.max(0.5, ratio));
    }
  }

  // 5. Reachability (10 points)
  let reachabilityScore = 0;
  if (verification.phone && verification.phoneVerified) reachabilityScore += 5;
  if (verification.email && verification.emailVerified) reachabilityScore += 5;
  breakdown.reachability = reachabilityScore;

  // 6. Data consistency (10 points). Only meaningful when at least one
  // fact was actually verified — a company with nothing confirmed has
  // nothing to be consistent with, so "no known conflicts" isn't real
  // positive evidence for it and shouldn't score any points, same as
  // every other signal above.
  const hasAnyVerifiedFact =
    !!(verification.ownerName && verification.ownerVerified) ||
    !!(verification.foundingYear && verification.foundingVerified) ||
    !!(
      verification.locationCount !== undefined &&
      verification.locationCount !== null &&
      verification.locationVerified
    ) ||
    !!(verification.teamSize && verification.teamSizeVerified) ||
    !!(verification.phone && verification.phoneVerified) ||
    !!(verification.email && verification.emailVerified);

  if (hasAnyVerifiedFact) {
    if (verification.conflicts && verification.conflicts.length === 0) {
      breakdown.dataConsistency = WEIGHTS.dataConsistency;
    } else if (!verification.conflicts) {
      breakdown.dataConsistency = WEIGHTS.dataConsistency;
    } else if (verification.conflicts.length === 1) {
      breakdown.dataConsistency = Math.round(WEIGHTS.dataConsistency * 0.5);
    }
  }

  breakdown.total = Object.values(breakdown).reduce((sum, val) => sum + val, 0) - breakdown.total;

  return { score: breakdown.total, breakdown };
}

export function calculateEvidenceLevel(
  verification: Partial<VerificationResult>
): EvidenceBreakdown {
  // Each "has*" flag requires the value AND its *Verified flag — matching
  // the build plan's own definition: "the share of these signals that
  // have a verified source quote", not just an extracted value.
  const evidence: EvidenceBreakdown = {
    hasOwner: !!verification.ownerName && !!verification.ownerVerified,
    hasFoundingYear: !!verification.foundingYear && !!verification.foundingVerified,
    hasLocationCount:
      verification.locationCount !== undefined &&
      verification.locationCount !== null &&
      !!verification.locationVerified,
    hasTeamSize: !!verification.teamSize && !!verification.teamSizeVerified,
    hasPhone: !!verification.phone && !!verification.phoneVerified,
    hasVerifiedEmail: !!verification.email && !!verification.emailVerified,
    count: 0,
    level: "low",
  };

  evidence.count = [
    evidence.hasOwner,
    evidence.hasFoundingYear,
    evidence.hasLocationCount,
    evidence.hasTeamSize,
    evidence.hasPhone,
    evidence.hasVerifiedEmail,
  ].filter(Boolean).length;

  if (evidence.count >= 5) {
    evidence.level = "high";
  } else if (evidence.count >= 3) {
    evidence.level = "medium";
  } else {
    evidence.level = "low";
  }

  return evidence;
}

export function detectConflicts(
  verification: Partial<VerificationResult>,
  imported: {
    owner?: string | null;
    employees?: number | null;
    revenue?: number | null;
    phone?: string | null;
  }
): string[] {
  const conflicts: string[] = [];

  // Only verified facts are compared — an AI value whose quote couldn't
  // be confirmed on the page isn't trustworthy enough to call a real
  // conflict (or, just as important, to count as "no conflict" and earn
  // the data-consistency score for a fact that was never actually
  // confirmed).

  if (
    imported.owner &&
    verification.ownerName &&
    verification.ownerVerified &&
    imported.owner !== verification.ownerName
  ) {
    conflicts.push(
      `Owner name: imported says ${imported.owner}, website says ${verification.ownerName}`
    );
  }

  if (
    imported.employees &&
    verification.teamSize &&
    verification.teamSizeVerified &&
    Math.abs(imported.employees - verification.teamSize) > 0
  ) {
    conflicts.push(
      `Team size: imported says ${imported.employees}, website says ${verification.teamSize}`
    );
  }

  // Cross-checks the second data source (Overture Maps / CSV) against the
  // phone the site itself reports, ignoring formatting differences.
  if (
    imported.phone &&
    verification.phone &&
    verification.phoneVerified &&
    normalizePhone(imported.phone) !== normalizePhone(verification.phone)
  ) {
    conflicts.push(
      `Phone: imported says ${imported.phone}, website says ${verification.phone}`
    );
  }

  return conflicts;
}
