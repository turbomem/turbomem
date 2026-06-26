import type { EmbeddingAdapter } from "../types.js";
import { EmbeddingError, ConfigError } from "../errors.js";
import { chunkArray } from "../utils/chunking.js";

/** Voyage embedding models and their default output dimensions. */
const MODEL_DIMENSIONS: Record<string, number> = {
  "voyage-3.5": 1024,
  "voyage-3.5-lite": 1024,
  "voyage-3-large": 1024,
  "voyage-4": 1024,
  "voyage-4-large": 1024,
  "voyage-4-lite": 1024,
  "voyage-code-3": 1024,
};

const DEFAULT_MODEL = "voyage-4";
const DEFAULT_ENDPOINT = "https://api.voyageai.com/v1/embeddings";
const MAX_BATCH = 128;

/** Minimal fetch signature so a stub can be injected in tests. */
export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

interface VoyageResponse {
  data: { index: number; embedding: number[] }[];
}

export type VoyageEmbeddingModel = keyof typeof MODEL_DIMENSIONS | (string & Record<never, never>);

export interface VoyageEmbeddingOptions {
  apiKey?: string;
  /** Full endpoint URL. Defaults to the public Voyage embeddings endpoint. */
  baseURL?: string;
  /** Defaults to `voyage-4`. */
  model?: VoyageEmbeddingModel;
  /** Override the dimension count (sent as `output_dimension`; default 1024). */
  dimensions?: number;
  /** Optional retrieval hint forwarded as `input_type` (`query` | `document`). */
  inputType?: "query" | "document";
  /** Inject a custom fetch implementation (used in tests). */
  fetchImpl?: FetchLike;
}

export class VoyageEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions: number;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly inputType?: "query" | "document";
  private readonly outputDimension?: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: VoyageEmbeddingOptions = {}) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.dimensions = options.dimensions ?? MODEL_DIMENSIONS[this.model] ?? 1024;
    // Only send output_dimension when it differs from the model default.
    this.outputDimension =
      options.dimensions && options.dimensions !== MODEL_DIMENSIONS[this.model]
        ? options.dimensions
        : undefined;
    this.endpoint = options.baseURL ?? DEFAULT_ENDPOINT;
    this.inputType = options.inputType;
    this.fetchImpl = options.fetchImpl ?? ((globalThis as { fetch: FetchLike }).fetch);

    const apiKey = options.apiKey ?? process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new ConfigError(
        "Voyage API key missing. Set VOYAGE_API_KEY or pass voyage.apiKey in the config.",
      );
    }
    this.apiKey = apiKey;
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      if (texts.length <= MAX_BATCH) {
        return await this.requestEmbeddings(texts);
      }

      const batches = chunkArray(texts, MAX_BATCH);
      const results = await Promise.all(batches.map((batch) => this.requestEmbeddings(batch)));
      return results.flat();
    } catch (error) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(
        `Voyage embedding request failed: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  private async requestEmbeddings(input: string[]): Promise<number[][]> {
    const body: Record<string, unknown> = { model: this.model, input };
    if (this.outputDimension) body.output_dimension = this.outputDimension;
    if (this.inputType) body.input_type = this.inputType;

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new EmbeddingError(
        `Voyage embedding request failed with status ${response.status}: ${detail}`,
      );
    }

    const json = (await response.json()) as VoyageResponse;
    // Preserve input ordering — the API may return out of order.
    return json.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }
}
