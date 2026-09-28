import OpenAI from "openai";

export interface ChatResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export function requireOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is required for live evals (extraction, embeddings, answering).");
  }
  return key;
}

export function createOpenAi(apiKey = process.env.OPENAI_API_KEY): OpenAI {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required.");
  return new OpenAI({ apiKey });
}

export async function chatComplete(
  client: OpenAI,
  options: { model: string; system: string; user: string; temperature?: number },
): Promise<ChatResult> {
  const response = await client.chat.completions.create({
    model: options.model,
    temperature: options.temperature ?? 0,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
  });
  return {
    text: response.choices[0]?.message?.content ?? "",
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  };
}

export class TokenCounter {
  prompt = 0;
  completion = 0;

  add(result: Pick<ChatResult, "promptTokens" | "completionTokens">): void {
    this.prompt += result.promptTokens;
    this.completion += result.completionTokens;
  }

  get total(): number {
    return this.prompt + this.completion;
  }
}
