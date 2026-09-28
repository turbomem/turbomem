/** Percentile of a copied, sorted numeric array. `p` in [0, 1]. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function latencyStats(samplesMs: number[]): { n: number; p50Ms: number; p95Ms: number; meanMs: number } {
  const n = samplesMs.length;
  if (n === 0) return { n: 0, p50Ms: 0, p95Ms: 0, meanMs: 0 };
  const meanMs = samplesMs.reduce((a, b) => a + b, 0) / n;
  return {
    n,
    p50Ms: Math.round(percentile(samplesMs, 0.5) * 100) / 100,
    p95Ms: Math.round(percentile(samplesMs, 0.95) * 100) / 100,
    meanMs: Math.round(meanMs * 100) / 100,
  };
}

export async function timeMs<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - start };
}
