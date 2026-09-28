import { describe, expect, it } from "vitest";
import { runProductSuite } from "../src/suites/product.js";

describe("product suite smoke (no live LLM)", () => {
  it("runs retrieval, scoping, dedup skip, and latency with hash embeddings", async () => {
    const result = await runProductSuite({ smoke: true });
    expect(result.extraction).toBeNull();
    expect(result.retrieval).not.toBeNull();
    expect(result.retrieval!.n).toBeGreaterThan(0);
    expect(result.retrieval!.recallAt5).toBeGreaterThan(0);
    expect(result.scoping).not.toBeNull();
    expect(result.scoping!.leakRate).toBe(0);
    expect(result.scoping!.isolationAccuracy).toBe(1);
    expect(result.dedup).not.toBeNull();
    expect(result.dedup!.n).toBeGreaterThan(0);
    expect(result.dedup!.accuracy).toBe(1);
    expect(result.latency).not.toBeNull();
    expect(result.latency!.add.n).toBeGreaterThan(0);
    expect(result.latency!.search.n).toBeGreaterThan(0);
  }, 60_000);
});
