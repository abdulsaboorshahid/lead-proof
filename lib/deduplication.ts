// Domain normalization and deduplication utilities

export function normalizeDomain(domain: string): string {
  let normalized = domain.toLowerCase().trim();

  normalized = normalized.replace(/^https?:\/\//, "");
  normalized = normalized.replace(/^www\./, "");
  normalized = normalized.split("/")[0];
  normalized = normalized.split(":")[0];

  return normalized;
}

// Strips formatting so "+1 (646) 714-1779" and "6467141779" compare equal.
// Keeps the last 10 digits, dropping a leading US country code if present.
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

export function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

export interface DuplicateGroup {
  primary: string;
  duplicates: string[];
  similarity: number;
}

export function findDuplicates(
  names: string[],
  threshold: number = 0.85
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < names.length; i++) {
    if (processed.has(names[i])) continue;

    const group: DuplicateGroup = {
      primary: names[i],
      duplicates: [],
      similarity: 1.0,
    };

    for (let j = i + 1; j < names.length; j++) {
      if (processed.has(names[j])) continue;

      const similarity = calculateSimilarity(
        names[i].toLowerCase(),
        names[j].toLowerCase()
      );

      if (similarity >= threshold) {
        group.duplicates.push(names[j]);
        processed.add(names[j]);
      }
    }

    if (group.duplicates.length > 0) {
      groups.push(group);
      processed.add(names[i]);
    }
  }

  return groups;
}

export interface DeduplicationResult {
  unique: string[];
  duplicates: DuplicateGroup[];
  originalCount: number;
  uniqueCount: number;
}

export function deduplicateByDomain(domains: string[]): string[] {
  const normalized = domains.map(normalizeDomain);
  return Array.from(new Set(normalized));
}

export function deduplicateByName(
  items: Array<{ domain: string; name: string }>,
  threshold: number = 0.85
): DeduplicationResult {
  const uniqueDomains = new Map<string, { domain: string; name: string }>();

  for (const item of items) {
    const normalized = normalizeDomain(item.domain);
    if (!uniqueDomains.has(normalized)) {
      uniqueDomains.set(normalized, { ...item, domain: normalized });
    }
  }

  const uniqueItems = Array.from(uniqueDomains.values());
  const names = uniqueItems.map(item => item.name);
  const duplicateGroups = findDuplicates(names, threshold);

  const duplicateNames = new Set(
    duplicateGroups.flatMap(g => g.duplicates)
  );

  const finalUnique = uniqueItems.filter(
    item => !Array.from(duplicateNames).includes(item.name)
  );

  return {
    unique: finalUnique.map(item => item.domain),
    duplicates: duplicateGroups,
    originalCount: items.length,
    uniqueCount: finalUnique.length,
  };
}
