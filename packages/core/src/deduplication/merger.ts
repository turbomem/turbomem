import type { ExtractionConfig } from "../types.js";
import { ConfigError } from "../errors.js";

export const MERGE_SYSTEM_PROMPT = `You are a memory consolidation system for an AI agent. You will receive one or more existing memory facts and one new fact that overlaps with them.

Your job is to return a single consolidated fact that:
- Is in third person (e.g. "The user prefers..." not "I prefer...")
- Combines all unique details from the existing facts and the new fact
- Prefers the new fact's information when there is a direct conflict
- Is concise and standalone

Return ONLY the merged fact as plain text. No explanation, no markdown, no JSON wrapper.`;

export interface MergerOptions {
  config: ExtractionConfig;
  /** Inject a custom completion function (used in tests). */
  completion?: (system: string, user: string) => Promise<string>;
}

/**
 * Consolidates overlapping memory facts using an LLM (Mem0-style multi-way merge).
 */
export class Merger {
  private readonly config: ExtractionConfig;
  private readonly completion: (system: string, user: string) => Promise<string>;

  constructor(options: MergerOptions) {
    this.config = options.config;
    this.completion = options.completion ?? this.defaultCompletion.bind(this);
  }

  async mergeMany(existingFacts: string[], newFact: string): Promise<string> {
    if (existingFacts.length === 0) return newFact.trim();

    const lines = [
      "Existing facts:",
      ...existingFacts.map((f, i) => `${i + 1}. ${f}`),
      "",
      `New fact: ${newFact}`,
    ];

    const raw = await this.completion(MERGE_SYSTEM_PROMPT, lines.join("\n"));
    const merged = raw.trim();
    if (!merged) {
      throw new Error("Merger returned empty content");
    }
    return merged;
  }

  private async defaultCompletion(system: string, user: string): Promise<string> {
    if (this.config.provider === "openai") {
      return this.openaiCompletion(system, user);
    }
    if (this.config.provider === "anthropic") {
      return this.anthropicCompletion(system, user);
    }
    if (this.config.provider === "google") {
      return this.googleCompletion(system, user);
    }
    throw new ConfigError(`Unsupported extraction provider: ${this.config.provider as string}`);
  }

  private async openaiCompletion(system: string, user: string): Promise<string> {
    const { default: OpenAI } = await import("openai");
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ConfigError("OpenAI API key missing for merge provider.");
    }
    const client = new OpenAI({ apiKey, baseURL: this.config.baseURL });
    const response = await client.chat.completions.create({
      model: this.config.model,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return response.choices[0]?.message?.content ?? "";
  }

  private async anthropicCompletion(system: string, user: string): Promise<string> {
    let Anthropic: typeof import("@anthropic-ai/sdk").default;
    try {
      Anthropic = (await import("@anthropic-ai/sdk")).default;
    } catch {
      throw new ConfigError(
        'The "@anthropic-ai/sdk" package is required for the anthropic merge provider. Install it with `npm install @anthropic-ai/sdk`.',
      );
    }
    const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ConfigError("Anthropic API key missing for merge provider.");
    }
    const client = new Anthropic({ apiKey, baseURL: this.config.baseURL });
    const response = await client.messages.create({
      model: this.config.model,
      max_tokens: 1024,
      temperature: 0,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = response.content[0];
    if (block && block.type === "text") return block.text;
    return "";
  }

  private async googleCompletion(system: string, user: string): Promise<string> {
    const apiKey =
      this.config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new ConfigError("Google API key missing for merge provider.");
    }
    const baseURL = (
      this.config.baseURL ?? "https://generativelanguage.googleapis.com/v1beta"
    ).replace(/\/$/, "");
    const url = `${baseURL}/models/${this.config.model}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0 },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Google merge request failed with status ${response.status}: ${detail}`);
    }

    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
}
