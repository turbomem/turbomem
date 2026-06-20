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
    extraction: { provider: "openai", model: "gpt-4o-mini", apiKey: "test-key" },
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
