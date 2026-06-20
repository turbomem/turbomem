import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIEmbeddingAdapter } from "../src/embeddings/openai.js";

/**
 * Build a fake OpenAI client whose `embeddings.create` returns deterministic
 * vectors and records how many times it was called.
 */
function makeFakeClient(dimensions: number) {
  const create = vi.fn(async ({ input }: { model: string; input: string[] }) => ({
    data: input.map((_, index) => ({
      index,
      embedding: new Array(dimensions).fill(0).map((_, d) => (index + 1) * 0.001 * (d + 1)),
    })),
  }));
  return { client: { embeddings: { create } }, create };
}

describe("OpenAIEmbeddingAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a float array of the correct dimension", async () => {
    const { client } = makeFakeClient(1536);
    const adapter = new OpenAIEmbeddingAdapter({ client: client as never });

    const vector = await adapter.embed("hello world");

    expect(adapter.dimensions).toBe(1536);
    expect(Array.isArray(vector)).toBe(true);
    expect(vector).toHaveLength(1536);
    expect(typeof vector[0]).toBe("number");
  });

  it("batches embedBatch(['a','b']) into a single API call", async () => {
    const { client, create } = makeFakeClient(1536);
    const adapter = new OpenAIEmbeddingAdapter({ client: client as never });

    const vectors = await adapter.embedBatch(["a", "b"]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(1536);
  });

  it("chunks batches larger than 100 into multiple requests", async () => {
    const { client, create } = makeFakeClient(8);
    const adapter = new OpenAIEmbeddingAdapter({
      client: client as never,
      model: "text-embedding-3-small",
      dimensions: 8,
    });

    const inputs = new Array(250).fill(0).map((_, i) => `text-${i}`);
    const vectors = await adapter.embedBatch(inputs);

    expect(create).toHaveBeenCalledTimes(3); // 100 + 100 + 50
    expect(vectors).toHaveLength(250);
  });

  it("supports text-embedding-3-large dimensions", () => {
    const { client } = makeFakeClient(3072);
    const adapter = new OpenAIEmbeddingAdapter({
      client: client as never,
      model: "text-embedding-3-large",
    });
    expect(adapter.dimensions).toBe(3072);
  });
});
