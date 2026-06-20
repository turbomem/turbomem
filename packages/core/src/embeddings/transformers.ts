import type { EmbeddingAdapter } from "../types.js";
import { EmbeddingError } from "../errors.js";

/** Known local models and their output dimensions. */
const MODEL_DIMENSIONS: Record<string, number> = {
  "Xenova/all-MiniLM-L6-v2": 384,
  "Xenova/bge-small-en-v1.5": 384,
};

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * Module-level cache of feature-extraction pipelines, keyed by model id, so the
 * (relatively expensive) WASM model is only initialised once per process.
 */
const pipelineCache = new Map<string, Promise<unknown>>();
let warnedAboutDownload = false;

// Minimal structural type for the transformers pipeline output we rely on.
type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array | number[] }>;

async function loadPipeline(model: string): Promise<FeatureExtractionPipeline> {
  let cached = pipelineCache.get(model);
  if (!cached) {
    if (!warnedAboutDownload) {
      warnedAboutDownload = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[turbomem] Downloading local embedding model "${model}" (~25MB) on first use. This is cached afterwards.`,
      );
    }
    cached = (async () => {
      let transformers: typeof import("@huggingface/transformers");
      try {
        transformers = await import("@huggingface/transformers");
      } catch (error) {
        throw new EmbeddingError(
          'The "@huggingface/transformers" package is required for local embeddings. Install it with `npm install @huggingface/transformers`.',
          { cause: error },
        );
      }
      return transformers.pipeline("feature-extraction", model);
    })();
    pipelineCache.set(model, cached);
  }
  return (await cached) as FeatureExtractionPipeline;
}

export interface TransformersEmbeddingOptions {
  /** Defaults to `Xenova/all-MiniLM-L6-v2`. */
  model?: string;
  /** Override dimensions for an unknown model. */
  dimensions?: number;
}

export class TransformersEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions: number;
  private readonly model: string;

  constructor(options: TransformersEmbeddingOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.dimensions = options.dimensions ?? MODEL_DIMENSIONS[this.model] ?? 384;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const pipe = await loadPipeline(this.model);
      const output = await pipe(text, { pooling: "mean", normalize: true });
      return Array.from(output.data as ArrayLike<number>);
    } catch (error) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(
        `Local embedding failed: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // WASM is single-threaded — process sequentially rather than in parallel.
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
}
