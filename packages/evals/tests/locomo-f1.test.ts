import { describe, expect, it } from "vitest";
import {
  locomoAdversarialScore,
  locomoF1Multi,
  locomoF1Score,
  normalizeAnswer,
  scoreLocomoQa,
} from "../src/scoring/locomo-f1.js";

describe("LoCoMo F1 port", () => {
  it("returns 1 for identical answers", () => {
    expect(locomoF1Score("Paris", "Paris")).toBe(1);
  });

  it("normalizes articles and punctuation", () => {
    expect(normalizeAnswer("The cat, and the hat!")).toBe("cat hat");
  });

  it("uses only the clause before ';' for category 3", () => {
    const a = scoreLocomoQa("2013", "2013; around then", 3);
    const b = scoreLocomoQa("2013", "2013", 4);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("scores multi-hop with comma-separated sub-answers (category 1)", () => {
    expect(locomoF1Multi("apples, oranges", "apples, oranges")).toBe(1);
    expect(locomoF1Multi("apples", "apples, oranges")).toBeGreaterThan(0);
    expect(locomoF1Multi("apples", "apples, oranges")).toBeLessThan(1);
  });

  it("scores adversarial refusals (category 5)", () => {
    expect(locomoAdversarialScore("No information available in the memories.")).toBe(1);
    expect(locomoAdversarialScore("It was not mentioned.")).toBe(1);
    expect(locomoAdversarialScore("They went to Spain")).toBe(0);
    expect(scoreLocomoQa("no information available", "something", 5)).toBe(1);
  });

  it("maps category 1 to multi-answer F1 and 4 to token F1", () => {
    expect(scoreLocomoQa("apples, oranges", "apples, oranges", 1)).toBe(1);
    expect(scoreLocomoQa("hiking", "hiking", 4)).toBe(1);
  });
});
