import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PGliteStorageAdapter } from "../src/storage/pglite.js";
import { TurboMemory } from "../src/memory.js";
import { upsertFact } from "../src/deduplication/upsert-fact.js";
import { Merger } from "../src/deduplication/merger.js";
import { resolveDeduplicationConfig } from "../src/deduplication/resolve-config.js";
import type { EmbeddingAdapter } from "../src/types.js";

const DIM = 16;
const SCOPE = { userId: "user_dedup" };

class FakeEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions = DIM;
  private readonly vectors: Map<string, number[]>;

  constructor(vectors: Record<string, number[]> = {}) {
    this.vectors = new Map(Object.entries(vectors));
  }

  async embed(text: string): Promise<number[]> {
    if (this.vectors.has(text)) return this.vectors.get(text)!;
    const vec = new Array(DIM).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % DIM] += text.charCodeAt(i) / 100;
    }
    return vec;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}

function vec(seed: number): number[] {
  return new Array(DIM).fill(0).map((_, i) => Math.abs(Math.sin(seed + i)) + 0.01);
}

function newMemory(
  overrides: {
    deduplication?: Parameters<typeof resolveDeduplicationConfig>[0];
    embeddings?: FakeEmbeddingAdapter;
    merger?: Merger;
  } = {},
) {
  const embeddings = overrides.embeddings ?? new FakeEmbeddingAdapter();
  const memory = new TurboMemory({
    embeddings,
    storage: new PGliteStorageAdapter({ inMemory: true }),
    extraction: { provider: "openai", model: "gpt-4.1-mini", apiKey: "test-key" },
    deduplication: overrides.deduplication,
  });
  return memory;
}

describe("upsertFact", () => {
  let storage: PGliteStorageAdapter;
  let embeddings: FakeEmbeddingAdapter;
  let merger: Merger;

  beforeEach(async () => {
    storage = new PGliteStorageAdapter({ inMemory: true });
    await storage.init(DIM);
    embeddings = new FakeEmbeddingAdapter({
      "seed fact": vec(1),
      "seed fact v2": vec(1),
      "unrelated fact": vec(50),
      "merged output": vec(1),
    });
    merger = new Merger({
      config: { provider: "openai", model: "gpt-4.1-mini", apiKey: "test" },
      completion: vi.fn(async () => "merged output"),
    });
  });

  afterEach(async () => {
    await storage.close();
  });

  it("inserts when deduplication is disabled", async () => {
    const config = resolveDeduplicationConfig({ enabled: false });
    await storage.insert({
      content: "seed fact",
      embedding: vec(1),
      userId: SCOPE.userId,
      metadata: {},
    });

    const result = await upsertFact(
      storage,
      embeddings,
      merger,
      config,
      "seed fact v2",
      vec(1),
      SCOPE,
    );

    expect(await storage.getAll(SCOPE)).toHaveLength(2);
    expect(result.content).toBe("seed fact v2");
  });

  it("skip returns existing memory without inserting", async () => {
    const config = resolveDeduplicationConfig({ strategy: "skip", threshold: 0.5 });
    const existing = await storage.insert({
      content: "seed fact",
      embedding: vec(1),
      userId: SCOPE.userId,
      metadata: {},
    });

    const result = await upsertFact(
      storage,
      embeddings,
      merger,
      config,
      "seed fact v2",
      vec(1),
      SCOPE,
    );

    expect(result.id).toBe(existing.id);
    expect(result.content).toBe("seed fact");
    expect(await storage.getAll(SCOPE)).toHaveLength(1);
  });

  it("replace updates when incoming is more specific", async () => {
    const config = resolveDeduplicationConfig({ strategy: "replace", threshold: 0.5 });
    const existing = await storage.insert({
      content: "The user lives in NYC",
      embedding: vec(1),
      userId: SCOPE.userId,
      metadata: {},
    });

    const incoming = "The user lives in Brooklyn, NYC";
    const result = await upsertFact(
      storage,
      embeddings,
      merger,
      config,
      incoming,
      vec(1),
      SCOPE,
    );

    expect(result.id).toBe(existing.id);
    expect(result.content).toBe(incoming);
    expect(await storage.getAll(SCOPE)).toHaveLength(1);
  });

  it("replace keeps existing when incoming is less specific", async () => {
    const config = resolveDeduplicationConfig({ strategy: "replace", threshold: 0.5 });
    const existing = await storage.insert({
      content: "The user is a senior TypeScript engineer on distributed systems",
      embedding: vec(1),
      userId: SCOPE.userId,
      metadata: {},
    });

    const result = await upsertFact(
      storage,
      embeddings,
      merger,
      config,
      "The user works in tech",
      vec(1),
      SCOPE,
    );

    expect(result.id).toBe(existing.id);
    expect(result.content).toBe(existing.content);
  });

  it("merge consolidates multiple matches in one LLM call and deletes extras", async () => {
    const mergeCompletion = vi.fn(async (_system: string, user: string) => {
      expect(user).toContain("Existing facts:");
      expect(user).toContain("fact one");
      expect(user).toContain("fact two");
      expect(user).toContain("fact three");
      expect(user).toContain("New fact: fact four");
      return "merged output";
    });
    merger = new Merger({
      config: { provider: "openai", model: "gpt-4.1-mini", apiKey: "test" },
      completion: mergeCompletion,
    });

    const config = resolveDeduplicationConfig({
      strategy: "merge",
      threshold: 0.5,
      mergeTopK: 5,
    });

    const primary = await storage.insert({
      content: "fact one",
      embedding: vec(1),
      userId: SCOPE.userId,
      metadata: {},
    });
    const extra1 = await storage.insert({
      content: "fact two",
      embedding: vec(1.01),
      userId: SCOPE.userId,
      metadata: {},
    });
    const extra2 = await storage.insert({
      content: "fact three",
      embedding: vec(1.02),
      userId: SCOPE.userId,
      metadata: {},
    });

    const result = await upsertFact(
      storage,
      embeddings,
      merger,
      config,
      "fact four",
      vec(1),
      SCOPE,
    );

    expect(mergeCompletion).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(primary.id);
    expect(result.content).toBe("merged output");

    const remaining = await storage.getAll(SCOPE);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(primary.id);
    expect(remaining.some((m) => m.id === extra1.id || m.id === extra2.id)).toBe(false);
  });

  it("merge falls back to smart replace on LLM failure", async () => {
    merger = new Merger({
      config: { provider: "openai", model: "gpt-4.1-mini", apiKey: "test" },
      completion: vi.fn(async () => {
        throw new Error("LLM down");
      }),
    });

    const config = resolveDeduplicationConfig({ strategy: "merge", threshold: 0.5 });
    const existing = await storage.insert({
      content: "The user lives in NYC",
      embedding: vec(1),
      userId: SCOPE.userId,
      metadata: {},
    });

    const incoming = "The user lives in Brooklyn, NYC";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await upsertFact(
      storage,
      embeddings,
      merger,
      config,
      incoming,
      vec(1),
      SCOPE,
    );

    warn.mockRestore();
    expect(result.id).toBe(existing.id);
    expect(result.content).toBe(incoming);
  });

  it("inserts when similarity is below threshold", async () => {
    const config = resolveDeduplicationConfig({ strategy: "skip", threshold: 0.99 });
    await storage.insert({
      content: "seed fact",
      embedding: vec(1),
      userId: SCOPE.userId,
      metadata: {},
    });

    await upsertFact(storage, embeddings, merger, config, "unrelated fact", vec(50), SCOPE);

    expect(await storage.getAll(SCOPE)).toHaveLength(2);
  });
});

describe("TurboMemory deduplication", () => {
  let memory: TurboMemory;

  afterEach(async () => {
    await memory?.close();
  });

  it("addFacts with deduplication disabled always inserts", async () => {
    memory = newMemory({
      deduplication: { enabled: false },
      embeddings: new FakeEmbeddingAdapter({ fact: vec(1) }),
    });
    await memory.init();

    await memory.addFacts(["fact"], SCOPE);
    await memory.addFacts(["fact"], SCOPE);

    expect(await memory.getAll(SCOPE)).toHaveLength(2);
  });

  it("addFacts with skip strategy does not duplicate similar facts", async () => {
    memory = newMemory({
      deduplication: { strategy: "skip", threshold: 0.5 },
      embeddings: new FakeEmbeddingAdapter({ "fact a": vec(1), "fact b": vec(1) }),
    });
    await memory.init();

    await memory.addFacts(["fact a"], SCOPE);
    await memory.addFacts(["fact b"], SCOPE);

    expect(await memory.getAll(SCOPE)).toHaveLength(1);
  });

  it("deduplication respects scope boundaries", async () => {
    memory = newMemory({
      deduplication: { strategy: "skip", threshold: 0.5 },
      embeddings: new FakeEmbeddingAdapter({ fact: vec(1) }),
    });
    await memory.init();

    await memory.addFacts(["fact"], { userId: "alice" });
    await memory.addFacts(["fact"], { userId: "bob" });

    expect(await memory.getAll({ userId: "alice" })).toHaveLength(1);
    expect(await memory.getAll({ userId: "bob" })).toHaveLength(1);
  });
});
