import type { EmbeddingAdapter } from "turbomem";

const DIM = 64;

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function l2Normalize(vec: number[]): number[] {
  let mag = 0;
  for (const x of vec) mag += x * x;
  mag = Math.sqrt(mag);
  if (mag === 0) return vec;
  return vec.map((x) => x / mag);
}

/**
 * Deterministic bag-of-tokens embedding for smoke tests (no network).
 * Not used for published semantic-recall numbers.
 */
export class HashEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions = DIM;

  async embed(text: string): Promise<number[]> {
    const vec = new Array(DIM).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    for (const token of tokens) {
      vec[hashToken(token) % DIM] += 1;
    }
    return l2Normalize(vec);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
