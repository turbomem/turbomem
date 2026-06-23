import type { EmbeddingAdapter } from "../types.js";
import { EmbeddingError, ConfigError } from "../errors.js";
import type { FetchLike } from "./voyage.js";

const DEFAULT_MODEL = "gemini-embedding-001";
const DEFAULT_DIMENSIONS = 3072;
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

interface SingleResponse {
  embedding: { values: number[] };
}

interface BatchResponse {
  embeddings: { values: number[] }[];
}

/** L2-normalize a vector to unit length. A no-op for already-normalized inputs. */
function normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) sumSquares += value * value;
  const magnitude = Math.sqrt(sumSquares);
  if (magnitude === 0) return vector;
  return vector.map((value) => value / magnitude);
}

export interface GoogleEmbeddingOptions {
  apiKey?: string;
  /** Base URL for the Generative Language API. */
  baseURL?: string;
  /** Defaults to `gemini-embedding-001`. */
  model?: string;
  /** Output dimensionality (128-3072). Defaults to 3072. */
  dimensions?: number;
  /** Optional task type hint (e.g. `RETRIEVAL_DOCUMENT`). */
  taskType?: string;
  /** Inject a custom fetch implementation (used in tests). */
  fetchImpl?: FetchLike;
}

export class GoogleEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly model: string;
  private readonly taskType?: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: GoogleEmbeddingOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.dimensions = options.dimensions ?? DEFAULT_DIMENSIONS;
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.taskType = options.taskType;
    this.fetchImpl = options.fetchImpl ?? ((globalThis as { fetch: FetchLike }).fetch);

    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new ConfigError(
        "Google API key missing. Set GEMINI_API_KEY or pass google.apiKey in the config.",
      );
    }
    this.apiKey = apiKey;
  }

  private get outputDimensionality(): number | undefined {
    return this.dimensions === DEFAULT_DIMENSIONS ? undefined : this.dimensions;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const url = `${this.baseURL}/models/${this.model}:embedContent`;
      const body: Record<string, unknown> = {
        content: { parts: [{ text }] },
      };
      if (this.outputDimensionality) body.outputDimensionality = this.outputDimensionality;
      if (this.taskType) body.taskType = this.taskType;

      const json = (await this.request(url, body)) as SingleResponse;
      return normalize(json.embedding.values);
    } catch (error) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(
        `Google embedding request failed: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      const url = `${this.baseURL}/models/${this.model}:batchEmbedContents`;
      const requests = texts.map((text) => {
        const req: Record<string, unknown> = {
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
        };
        if (this.outputDimensionality) req.outputDimensionality = this.outputDimensionality;
        if (this.taskType) req.taskType = this.taskType;
        return req;
      });

      const json = (await this.request(url, { requests })) as BatchResponse;
      return json.embeddings.map((item) => normalize(item.values));
    } catch (error) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(
        `Google embedding request failed: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  private async request(url: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new EmbeddingError(
        `Google embedding request failed with status ${response.status}: ${detail}`,
      );
    }

    return response.json();
  }
}
