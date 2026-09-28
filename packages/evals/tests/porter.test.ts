import { describe, expect, it } from "vitest";
import { porterStem } from "../src/scoring/porter.js";

describe("porterStem (NLTK/Porter 1980)", () => {
  it("stems common inflection", () => {
    expect(porterStem("cats")).toBe("cat");
    expect(porterStem("running")).toBe("run");
    expect(porterStem("connected")).toBe("connect");
    expect(porterStem("connections")).toBe("connect");
  });

  it("applies step 2/3/4 reductions from Porter's paper", () => {
    expect(porterStem("relational")).toBe("relat");
    expect(porterStem("generalization")).toBe("gener");
    expect(porterStem("oscillator")).toBe("oscil");
  });

  it("leaves short words alone", () => {
    expect(porterStem("a")).toBe("a");
    expect(porterStem("is")).toBe("is");
  });
});
