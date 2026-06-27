import { describe, it, expect } from "vitest";
import { isMoreSpecific, specificityScore } from "../src/deduplication/specificity.js";

describe("specificityScore", () => {
  it("returns 0 for empty text", () => {
    expect(specificityScore("")).toBe(0);
    expect(specificityScore("   ")).toBe(0);
  });

  it("scores denser text higher than verbose filler", () => {
    const concise = "The user lives in Brooklyn, NYC";
    const verbose =
      "The user lives in Brooklyn, NYC and the user lives in Brooklyn, NYC in the city";
    expect(specificityScore(concise)).toBeGreaterThan(specificityScore(verbose));
  });

  it("uses score tie-breaker for equal token counts", () => {
    const a = "The user likes pizza";
    const b = "The user likes pasta";
    expect(specificityScore(a)).toBe(specificityScore(b));
  });
});

describe("isMoreSpecific", () => {
  it("prefers more information-dense incoming fact", () => {
    const existing = "The user lives in NYC";
    const incoming = "The user lives in Brooklyn, NYC";
    expect(isMoreSpecific(incoming, existing)).toBe(true);
    expect(isMoreSpecific(existing, incoming)).toBe(false);
  });

  it("keeps existing when incoming is less specific", () => {
    const existing =
      "The user is a senior TypeScript engineer working on distributed systems";
    const incoming = "The user works in tech";
    expect(isMoreSpecific(incoming, existing)).toBe(false);
  });

  it("prefers more unique tokens when neither is a subset", () => {
    expect(isMoreSpecific("User codes TypeScript React", "User codes TypeScript")).toBe(true);
  });
});
