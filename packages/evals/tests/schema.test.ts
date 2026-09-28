import { describe, expect, it } from "vitest";
import { EvalSnapshotSchema } from "../src/results/schema.js";
import { buildSnapshot } from "../src/snapshot.js";
import { buildEvalConfig } from "../src/runner.js";

describe("EvalSnapshotSchema", () => {
  it("parses a minimal unpublished snapshot", () => {
    const snap = buildSnapshot({
      config: buildEvalConfig({ smoke: true }),
      product: {
        extraction: null,
        retrieval: { n: 5, recallAt1: 1, recallAt5: 1, mrr: 1 },
        dedup: { n: 2, accuracy: 1 },
        scoping: { n: 4, leakRate: 0, isolationAccuracy: 1 },
        latency: {
          add: { n: 1, p50Ms: 1, p95Ms: 1, meanMs: 1 },
          search: { n: 1, p50Ms: 1, p95Ms: 1, meanMs: 1 },
        },
      },
      locomo: null,
      published: false,
      notes: "test",
    });
    expect(EvalSnapshotSchema.parse(snap).schemaVersion).toBe(1);
    expect(snap.published).toBe(false);
    expect(snap.suites.locomo).toBeNull();
  });
});
