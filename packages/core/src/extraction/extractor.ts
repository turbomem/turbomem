import type { ExtractionConfig, Message } from "../types.js";
import { ConfigError } from "../errors.js";
import { formatTranscript } from "../utils/chunking.js";

export const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction system for an AI agent. Your job is to extract discrete, reusable facts from a conversation that would be useful to remember in future conversations.

Rules:
- Extract facts that are about the USER, not about the AI's responses
- Each fact should be a single, standalone statement
- Facts should be in third person (e.g. "The user prefers..." not "I prefer...")
- Only extract facts that are likely to be relevant in future conversations
- Do not extract facts that are specific to the current task and won't matter later
- Do not extract opinions the AI expressed
- If no memorable facts exist, return an empty array

Return ONLY a JSON array of strings. No explanation, no markdown, no wrapper object.
Example output: ["The user prefers concise responses", "The user works in TypeScript"]`;

/**
 * Best-effort parse of an LLM response into an array of fact strings.
 * Tolerates models that wrap the array in markdown fences or a JSON object.
 */
export function parseFacts(raw: string): string[] {
  if (!raw) return [];
  let text = raw.trim();

  // Strip markdown code fences if present.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    }
    // Tolerate { facts: [...] } / { memories: [...] } wrappers.
    if (parsed && typeof parsed === "object") {
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        }
      }
    }
  } catch {
    // Fall through — attempt to locate a bare array within the text.
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed: unknown = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        }
      } catch {
        /* give up */
      }
    }
  }

  return [];
}

export interface ExtractorOptions {
  config: ExtractionConfig;
  /** Inject a custom completion function (used in tests). */
  completion?: (system: string, user: string) => Promise<string>;
}

/**
 * Extracts discrete, reusable facts from a conversation using an LLM.
 * Extraction is treated as non-fatal: on any failure it logs a warning and
 * returns an empty array rather than throwing.
 */
export class Extractor {
  private readonly config: ExtractionConfig;
  private readonly completion: (system: string, user: string) => Promise<string>;

  constructor(options: ExtractorOptions) {
    this.config = options.config;
    this.completion = options.completion ?? this.defaultCompletion.bind(this);
  }

  async extract(messages: Message[]): Promise<string[]> {
    if (messages.length === 0) return [];

    const transcript = formatTranscript(messages);
    const user = `Conversation:\n${transcript}`;

    try {
      const raw = await this.completion(EXTRACTION_SYSTEM_PROMPT, user);
      return parseFacts(raw);
    } catch (error) {
      // Non-fatal: never block the add() flow on extraction issues.
      // eslint-disable-next-line no-console
      console.warn(`[turbomem] Fact extraction failed, skipping: ${(error as Error).message}`);
      return [];
    }
  }

  private async defaultCompletion(system: string, user: string): Promise<string> {
    if (this.config.provider === "openai") {
      return this.openaiCompletion(system, user);
    }
    if (this.config.provider === "anthropic") {
      return this.anthropicCompletion(system, user);
    }
    throw new ConfigError(`Unsupported extraction provider: ${this.config.provider as string}`);
  }

  private async openaiCompletion(system: string, user: string): Promise<string> {
    const { default: OpenAI } = await import("openai");
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ConfigError("OpenAI API key missing for extraction provider.");
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
        'The "@anthropic-ai/sdk" package is required for the anthropic extraction provider. Install it with `npm install @anthropic-ai/sdk`.',
      );
    }
    const apiKey = this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ConfigError("Anthropic API key missing for extraction provider.");
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
}
