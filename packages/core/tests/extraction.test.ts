import { describe, it, expect, vi, afterEach } from "vitest";
import { Extractor, parseFacts } from "../src/extraction/extractor.js";

describe("parseFacts", () => {
  it("parses a bare JSON array", () => {
    expect(parseFacts('["a", "b"]')).toEqual(["a", "b"]);
  });

  it("strips markdown fences", () => {
    expect(parseFacts('```json\n["a"]\n```')).toEqual(["a"]);
  });

  it("tolerates a wrapper object", () => {
    expect(parseFacts('{"facts": ["a", "b"]}')).toEqual(["a", "b"]);
  });

  it("returns [] for unparseable input", () => {
    expect(parseFacts("not json")).toEqual([]);
  });
});

describe("Extractor (google provider)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the Gemini generateContent endpoint and parses facts", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: '["The user likes tea"]' }] } },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const extractor = new Extractor({
      config: { provider: "google", model: "gemini-3.5-flash", apiKey: "k" },
    });

    const facts = await extractor.extract([{ role: "user", content: "I drink tea daily" }]);

    expect(facts).toEqual(["The user likes tea"]);
    const call = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(call[0]).toContain("gemini-3.5-flash:generateContent");
    expect(call[1].headers["x-goog-api-key"]).toBe("k");
  });

  it("returns [] (non-fatal) when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "server error",
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const extractor = new Extractor({
      config: { provider: "google", model: "gemini-3.5-flash", apiKey: "k" },
    });

    const facts = await extractor.extract([{ role: "user", content: "hi" }]);

    expect(facts).toEqual([]);
    warn.mockRestore();
  });
});
