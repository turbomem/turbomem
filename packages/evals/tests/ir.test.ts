import { describe, expect, it } from "vitest";
import { recallAtK, reciprocalRank } from "../src/scoring/ir.js";
import { percentile } from "../src/scoring/latency.js";

describe("IR metrics", () => {
  it("computes recall@k and MRR", () => {
    const ranked = ["red car", "hiking", "vegetarian"];
    const relevant = ["hiking"];
    expect(recallAtK(ranked, relevant, 1)).toBe(0);
    expect(recallAtK(ranked, relevant, 2)).toBe(1);
    expect(recallAtK(ranked, relevant, 5)).toBe(1);
    expect(reciprocalRank(ranked, relevant)).toBe(0.5);
  });

  it("is case-insensitive", () => {
    expect(recallAtK(["The user loves Hiking"], ["the user loves hiking"], 1)).toBe(1);
  });

  it("treats empty relevant as vacuously correct", () => {
    expect(recallAtK(["x"], [], 1)).toBe(1);
    expect(reciprocalRank(["x"], [])).toBe(1);
  });
});

describe("percentile", () => {
  it("interpolates", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([10], 0.95)).toBe(10);
    expect(percentile([], 0.5)).toBe(0);
  });
});
