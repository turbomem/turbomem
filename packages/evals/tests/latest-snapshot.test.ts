import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LATEST_RESULTS_PATH } from "../src/paths.js";
import { EvalSnapshotSchema } from "../src/results/schema.js";

describe("committed latest.json", () => {
  it("matches the public snapshot schema", () => {
    const raw = JSON.parse(readFileSync(LATEST_RESULTS_PATH, "utf8"));
    const snap = EvalSnapshotSchema.parse(raw);
    expect(snap.schemaVersion).toBe(1);
    expect(snap.gitSha.length).toBeGreaterThan(0);
  });
});
