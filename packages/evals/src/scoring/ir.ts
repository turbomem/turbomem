export interface RankedHit {
  /** Retrieved item identity (content or id). */
  key: string;
}

function normalizeKey(s: string): string {
  return s.trim().toLowerCase();
}

function firstRelevantRank(ranked: string[], relevant: string[]): number | null {
  const gold = new Set(relevant.map(normalizeKey));
  for (let i = 0; i < ranked.length; i++) {
    if (gold.has(normalizeKey(ranked[i]))) return i + 1;
  }
  return null;
}

/** Fraction of queries with a relevant result in the top k. */
export function recallAtK(ranked: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 1;
  const gold = new Set(relevant.map(normalizeKey));
  return ranked.slice(0, k).some((item) => gold.has(normalizeKey(item))) ? 1 : 0;
}

/** Mean Reciprocal Rank of the first relevant result (0 if none). */
export function reciprocalRank(ranked: string[], relevant: string[]): number {
  if (relevant.length === 0) return 1;
  const rank = firstRelevantRank(ranked, relevant);
  return rank === null ? 0 : 1 / rank;
}

export function meanMetric(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Best cosine match of `target` against `candidates`. Returns 1 when any pair
 * is at or above `threshold`.
 */
export function cosineCovered(
  targetEmbedding: number[],
  candidateEmbeddings: number[][],
  threshold: number,
  similarity: (a: number[], b: number[]) => number,
): boolean {
  if (candidateEmbeddings.length === 0) return false;
  let best = -1;
  for (const c of candidateEmbeddings) {
    const s = similarity(targetEmbedding, c);
    if (s > best) best = s;
  }
  return best >= threshold;
}

export { firstRelevantRank };
