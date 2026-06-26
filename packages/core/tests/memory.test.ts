import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the OpenAI SDK so the extractor never makes a real network call.
const chatCreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: class FakeOpenAI {
      chat = { completions: { create: chatCreate } };
      embeddings = { create: vi.fn() };
    },
  };
});

import { TurboMemory } from "../src/memory.js";
import { PGliteStorageAdapter } from "../src/storage/pglite.js";
import { NotInitialisedError } from "../src/errors.js";
import type { EmbeddingAdapter } from "../src/types.js";

const DIM = 16;

/** Deterministic local embedding so tests don't need a network/model. */
class FakeEmbeddingAdapter implements EmbeddingAdapter {
  readonly dimensions = DIM;
  async embed(text: string): Promise<number[]> {
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

function mockExtraction(facts: string[]) {
  chatCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(facts) } }],
  });
}

function newMemory() {
  return new TurboMemory({
    embeddings: new FakeEmbeddingAdapter(),
    storage: new PGliteStorageAdapter({ inMemory: true }),
    extraction: { provider: "openai", model: "gpt-4.1-mini", apiKey: "test-key" },
  });
}

describe("TurboMemory", () => {
  let memory: TurboMemory;

  beforeEach(async () => {
    chatCreate.mockReset();
    memory = newMemory();
    await memory.init();
  });

  afterEach(async () => {
    await memory.close();
  });

  it("add() extracts facts and returns Memory objects", async () => {
    mockExtraction(["The user prefers concise responses", "The user works in TypeScript"]);

    const created = await memory.add(
      [{ role: "user", content: "I like short answers and I code in TS" }],
      { userId: "user_123" },
    );

    expect(created).toHaveLength(2);
    expect(created[0].id).toBeTruthy();
    expect(created[0].embedding).toHaveLength(DIM);
    expect(created[0].userId).toBe("user_123");
    expect(created.map((m) => m.content)).toContain("The user works in TypeScript");
  });

  it("add() returns [] when nothing memorable is extracted", async () => {
    mockExtraction([]);
    const created = await memory.add([{ role: "user", content: "hi" }], { userId: "user_123" });
    expect(created).toEqual([]);
  });

  it("search() returns results ordered by score descending", async () => {
    mockExtraction([
      "The user loves Italian food",
      "The user enjoys pizza and pasta",
      "The user drives a red car",
    ]);
    await memory.add([{ role: "user", content: "food and car talk" }], { userId: "u" });

    const results = await memory.search("pizza and pasta", { userId: "u", limit: 5 });

    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("search() respects userId scope", async () => {
    mockExtraction(["The user likes hiking"]);
    await memory.add([{ role: "user", content: "alice talk" }], { userId: "alice" });

    chatCreate.mockReset();
    mockExtraction(["The user likes swimming"]);
    await memory.add([{ role: "user", content: "bob talk" }], { userId: "bob" });

    const aliceResults = await memory.search("activities", { userId: "alice", limit: 10 });
    expect(aliceResults.length).toBe(1);
    expect(aliceResults[0].memory.userId).toBe("alice");
    expect(aliceResults.every((r) => r.memory.userId !== "bob")).toBe(true);
  });

  it("deleteAll() removes all memories for a user", async () => {
    mockExtraction(["fact one", "fact two"]);
    await memory.add([{ role: "user", content: "x" }], { userId: "user_x" });
    expect(await memory.getAll({ userId: "user_x" })).toHaveLength(2);

    await memory.deleteAll({ userId: "user_x" });
    expect(await memory.getAll({ userId: "user_x" })).toHaveLength(0);
  });

  it("delete() removes a specific memory", async () => {
    mockExtraction(["fact one", "fact two"]);
    const created = await memory.add([{ role: "user", content: "x" }], { userId: "user_d" });
    await memory.delete(created[0].id);
    const remaining = await memory.getAll({ userId: "user_d" });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(created[1].id);
  });

  it("addFacts() stores facts directly without extraction", async () => {
    const created = await memory.addFacts(["A direct fact"], { userId: "user_f" });
    expect(created).toHaveLength(1);
    expect(chatCreate).not.toHaveBeenCalled();
  });
});

describe("TurboMemory before init", () => {
  it("throws a clear error when methods are called before init()", async () => {
    const memory = newMemory();
    await expect(memory.search("x", { userId: "u" })).rejects.toBeInstanceOf(NotInitialisedError);
    await expect(memory.add([{ role: "user", content: "y" }], { userId: "u" })).rejects.toBeInstanceOf(
      NotInitialisedError,
    );
    await expect(memory.getAll({ userId: "u" })).rejects.toBeInstanceOf(NotInitialisedError);
  });
});

describe("TurboMemory with sqlite-vec storage", () => {
  let memory: TurboMemory;

  beforeEach(async () => {
    chatCreate.mockReset();
    memory = new TurboMemory({
      embeddings: new FakeEmbeddingAdapter(),
      storage: "sqlite-vec",
      sqliteVec: { inMemory: true },
      extraction: { provider: "openai", model: "gpt-4.1-mini", apiKey: "test-key" },
    });
    await memory.init();
  });

  afterEach(async () => {
    await memory.close();
  });

  it("addFacts() stores and searches memories", async () => {
    await memory.addFacts(["The user prefers sqlite for local storage"], { userId: "user_sqlite" });

    const results = await memory.search("local database preference", {
      userId: "user_sqlite",
      limit: 5,
    });

    expect(results.length).toBe(1);
    expect(results[0].memory.content).toBe("The user prefers sqlite for local storage");
  });
});

describe("TurboMemory with upstash-vector storage", () => {
  let memory: TurboMemory;

  beforeEach(async () => {
    chatCreate.mockReset();
    const { UpstashVectorStorageAdapter } = await import("../src/storage/upstash-vector.js");

    class MockUpstashIndex {
      readonly dimension = DIM;
      private readonly store = new Map<
        string,
        { vector: number[]; metadata: import("../src/storage/upstash-vector.js").UpstashMemoryMetadata }
      >();

      async info() {
        return { dimension: this.dimension };
      }

      async upsert(
        args: {
          id: string | number;
          vector: number[];
          metadata?: import("../src/storage/upstash-vector.js").UpstashMemoryMetadata;
        },
      ) {
        if (args.metadata) {
          this.store.set(String(args.id), { vector: args.vector, metadata: args.metadata });
        }
        return "OK";
      }

      async query(args: { vector: number[]; topK: number; filter?: string }) {
        const userId = args.filter?.match(/userId = "([^"]+)"/)?.[1];
        return [...this.store.entries()]
          .filter(([, row]) => !userId || row.metadata.userId === userId)
          .map(([id, row]) => ({
            id,
            score: 0.9,
            vector: row.vector,
            metadata: row.metadata,
          }))
          .slice(0, args.topK);
      }

      async range(args: { cursor: number | string; limit: number }) {
        const start = Number(args.cursor) || 0;
        const entries = [...this.store.entries()].slice(start, start + args.limit);
        return {
          nextCursor: start + entries.length >= this.store.size ? "" : String(start + entries.length),
          vectors: entries.map(([id, row]) => ({
            id,
            vector: row.vector,
            metadata: row.metadata,
          })),
        };
      }

      async delete(payload: string | { filter: string }) {
        if (typeof payload === "object" && "filter" in payload) {
          const userId = payload.filter.match(/userId = "([^"]+)"/)?.[1];
          let deleted = 0;
          for (const [id, row] of this.store.entries()) {
            if (!userId || row.metadata.userId === userId) {
              this.store.delete(id);
              deleted++;
            }
          }
          return { deleted };
        }
        return { deleted: this.store.delete(String(payload)) ? 1 : 0 };
      }
    }

    memory = new TurboMemory({
      embeddings: new FakeEmbeddingAdapter(),
      storage: new UpstashVectorStorageAdapter({ index: new MockUpstashIndex() as never }),
      extraction: { provider: "openai", model: "gpt-4.1-mini", apiKey: "test-key" },
    });
    await memory.init();
  });

  afterEach(async () => {
    await memory.close();
  });

  it("addFacts() stores and searches memories", async () => {
    await memory.addFacts(["The user deploys to Cloudflare Workers"], { userId: "user_edge" });

    const results = await memory.search("edge deployment", {
      userId: "user_edge",
      limit: 5,
    });

    expect(results.length).toBe(1);
    expect(results[0].memory.content).toBe("The user deploys to Cloudflare Workers");
  });
});
