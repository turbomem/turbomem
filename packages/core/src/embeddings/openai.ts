import OpenAI from "openai";
import type { EmbeddingAdapter } from "../types.js";
import { EmbeddingError, ConfigError } from "../errors.js";
import { chunkArray } from "../utils/chunking.js";

/** OpenAI embedding models and their output dimensions. */
const MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

const MAX_BATCH = 100;

export type OpenAIEmbeddingModel = keyof typeof MODEL_DIMENSIONS | (string & Record<never, never>);

export interface OpenAIEmbeddingOptions {
  apiKey?: string;
  baseURL?: string;
  /** Defaults to `text-embedding-3-small`. */
  model?: OpenAIEmbeddingModel;
  /** Override the dimension count (required for unknown models). */
  dimensions?: number;
  /** Inject a pre-built client (used in tests). */
  client?: OpenAI;
}

export class OpenAIEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions: number;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIEmbeddingOptions = {}) {
    this.model = options.model ?? "text-embedding-3-small";

    const resolvedDimensions = options.dimensions ?? MODEL_DIMENSIONS[this.model];
    if (!resolvedDimensions) {
      throw new ConfigError(
        `Unknown OpenAI embedding model "${this.model}". Pass an explicit \`dimensions\` value.`,
      );
    }
    this.dimensions = resolvedDimensions;

    if (options.client) {
      this.client = options.client;
    } else {
      const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new ConfigError(
          "OpenAI API key missing. Set OPENAI_API_KEY or pass openai.apiKey in the config.",
        );
      }
      this.client = new OpenAI({ apiKey, baseURL: options.baseURL });
    }
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedBatch([text]);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      // One request when under the limit; otherwise chunk into groups of 100.
      if (texts.length <= MAX_BATCH) {
        return await this.requestEmbeddings(texts);
      }

      const batches = chunkArray(texts, MAX_BATCH);
      const results = await Promise.all(batches.map((batch) => this.requestEmbeddings(batch)));
      return results.flat();
    } catch (error) {
      if (error instanceof EmbeddingError) throw error;
      throw new EmbeddingError(
        `OpenAI embedding request failed: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  private async requestEmbeddings(input: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input,
    });

    // Preserve input ordering — the API may return out of order.
    return response.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding as number[]);
  }
}
