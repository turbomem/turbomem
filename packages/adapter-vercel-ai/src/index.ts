import { tool } from "ai";
import { z } from "zod";
import type { MemoryScope, TurboMemory } from "turbomem";

export interface CreateMemoryToolsOptions {
  /** Max number of memories returned by `recallMemories`. Defaults to 5. */
  recallLimit?: number;
}

/**
 * Expose a {@link TurboMemory} instance as a pair of Vercel AI SDK tools:
 * `rememberFact` (write) and `recallMemories` (read). Spread the result into
 * the `tools` map of a `generateText` / `streamText` call.
 *
 * ```ts
 * const result = await generateText({
 *   model: openai("gpt-4.1-mini"),
 *   tools: createMemoryTools(memory, { userId: "user_123" }),
 *   prompt: "...",
 * });
 * ```
 */
export function createMemoryTools(
  memory: TurboMemory,
  scope: MemoryScope,
  options: CreateMemoryToolsOptions = {},
) {
  const recallLimit = options.recallLimit ?? 5;

  return {
    rememberFact: tool({
      description: "Store an important fact about the user for future reference.",
      parameters: z.object({
        fact: z.string().describe("A single, standalone fact worth remembering about the user."),
      }),
      execute: async ({ fact }: { fact: string }) => {
        const created = await memory.addFacts([fact], scope);
        return { success: true, stored: created.length };
      },
    }),

    recallMemories: tool({
      description: "Search your memory for information relevant to the current context.",
      parameters: z.object({
        query: z.string().describe("What to look up in memory."),
      }),
      execute: async ({ query }: { query: string }) => {
        const results = await memory.search(query, { ...scope, limit: recallLimit });
        return { memories: results.map((r) => r.memory.content) };
      },
    }),
  };
}

export type { MemoryScope, TurboMemory } from "turbomem";
