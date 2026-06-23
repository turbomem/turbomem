import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAIEmbeddingAdapter } from "../src/embeddings/openai.js";
import { VoyageEmbeddingAdapter } from "../src/embeddings/voyage.js";
import { GoogleEmbeddingAdapter } from "../src/embeddings/google.js";
import type { FetchLike } from "../src/embeddings/voyage.js";

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

/** Build a fetch stub returning a Voyage-shaped (OpenAI-like) response. */
function makeVoyageFetch(dimensions: number, reverseOrder = false) {
  const fetchImpl = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>(async (_url, init) => {
    const body = JSON.parse(init.body) as { input: string[] };
    const data = body.input.map((_text, index) => ({
      index,
      embedding: new Array(dimensions).fill(0).map((_, d) => (index + 1) * 0.001 * (d + 1)),
    }));
    if (reverseOrder) data.reverse();
    return {
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ data }),
    };
  });
  return fetchImpl;
}

describe("VoyageEmbeddingAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to voyage-3.5 with 1024 dimensions", async () => {
    const fetchImpl = makeVoyageFetch(1024);
    const adapter = new VoyageEmbeddingAdapter({ apiKey: "k", fetchImpl });

    const vector = await adapter.embed("hello");

    expect(adapter.dimensions).toBe(1024);
    expect(vector).toHaveLength(1024);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("batches embedBatch(['a','b']) into a single request and preserves order", async () => {
    const fetchImpl = makeVoyageFetch(8, true);
    const adapter = new VoyageEmbeddingAdapter({ apiKey: "k", dimensions: 8, fetchImpl });

    const vectors = await adapter.embedBatch(["a", "b"]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(vectors).toHaveLength(2);
    // index 0 -> first row regardless of API ordering.
    expect(vectors[0][0]).toBeCloseTo(0.001);
    expect(vectors[1][0]).toBeCloseTo(0.002);
  });

  it("chunks batches larger than 128 into multiple requests", async () => {
    const fetchImpl = makeVoyageFetch(4);
    const adapter = new VoyageEmbeddingAdapter({ apiKey: "k", dimensions: 4, fetchImpl });

    const inputs = new Array(300).fill(0).map((_, i) => `text-${i}`);
    const vectors = await adapter.embedBatch(inputs);

    expect(fetchImpl).toHaveBeenCalledTimes(3); // 128 + 128 + 44
    expect(vectors).toHaveLength(300);
  });

  it("sends output_dimension only for non-default dimensions", async () => {
    const fetchImpl = makeVoyageFetch(512);
    const adapter = new VoyageEmbeddingAdapter({ apiKey: "k", dimensions: 512, fetchImpl });

    await adapter.embed("hi");

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body) as { output_dimension?: number };
    expect(body.output_dimension).toBe(512);
  });

  it("throws EmbeddingError on a non-ok response", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 401,
      text: async () => "unauthorized",
      json: async () => ({}),
    });
    const adapter = new VoyageEmbeddingAdapter({ apiKey: "bad", fetchImpl });

    await expect(adapter.embed("x")).rejects.toThrow(/Voyage embedding request failed/);
  });
});

describe("GoogleEmbeddingAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to gemini-embedding-001 with 3072 dimensions and normalizes", async () => {
    const fetchImpl = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ embedding: { values: [3, 4] } }),
    }));
    const adapter = new GoogleEmbeddingAdapter({ apiKey: "k", fetchImpl });

    const vector = await adapter.embed("hello");

    expect(adapter.dimensions).toBe(3072);
    // [3,4] L2-normalized -> [0.6, 0.8]
    expect(vector[0]).toBeCloseTo(0.6);
    expect(vector[1]).toBeCloseTo(0.8);
  });

  it("uses batchEmbedContents and normalizes each vector", async () => {
    const fetchImpl = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>(async (url) => {
      expect(url).toContain(":batchEmbedContents");
      return {
        ok: true,
        status: 200,
        text: async () => "",
        json: async () => ({ embeddings: [{ values: [0, 5] }, { values: [6, 8] }] }),
      };
    });
    const adapter = new GoogleEmbeddingAdapter({ apiKey: "k", fetchImpl });

    const vectors = await adapter.embedBatch(["a", "b"]);

    expect(vectors).toHaveLength(2);
    expect(vectors[0][1]).toBeCloseTo(1); // [0,5] -> [0,1]
    expect(vectors[1][0]).toBeCloseTo(0.6); // [6,8] -> [0.6,0.8]
  });

  it("sends outputDimensionality for non-default dimensions", async () => {
    const fetchImpl = vi.fn<Parameters<FetchLike>, ReturnType<FetchLike>>(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({ embedding: { values: [1, 0] } }),
    }));
    const adapter = new GoogleEmbeddingAdapter({ apiKey: "k", dimensions: 768, fetchImpl });

    await adapter.embed("hi");

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body) as { outputDimensionality?: number };
    expect(adapter.dimensions).toBe(768);
    expect(body.outputDimensionality).toBe(768);
  });

  it("throws EmbeddingError on a non-ok response", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 403,
      text: async () => "forbidden",
      json: async () => ({}),
    });
    const adapter = new GoogleEmbeddingAdapter({ apiKey: "bad", fetchImpl });

    await expect(adapter.embed("x")).rejects.toThrow(/Google embedding request failed/);
  });
});
