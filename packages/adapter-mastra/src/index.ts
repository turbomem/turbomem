import type { Memory, Message, TurboMemory } from "turbomem";

/**
 * Context passed by Mastra when remembering or recalling. Mirrors the scope
 * fields turbomem understands.
 */
export interface MastraMemoryContext {
  userId?: string;
  agentId?: string;
  sessionId?: string;
}

/**
 * Minimal structural shape of a Mastra memory provider. We define it locally so
 * this package does not hard-depend on a specific `@mastra/core` version — the
 * returned object is structurally compatible with Mastra's provider contract.
 *
 * Verify against your installed Mastra version's `MastraMemoryProvider` type.
 */
export interface MastraMemoryProvider {
  remember(messages: Message[], context: MastraMemoryContext): Promise<Memory[]>;
  recall(query: string, context: MastraMemoryContext): Promise<string>;
}

export interface CreateMastraMemoryOptions {
  /** Max number of memories to inject on recall. Defaults to 5. */
  recallLimit?: number;
}

/**
 * Wrap a {@link TurboMemory} instance as a Mastra memory provider.
 *
 * ```ts
 * const memory = new TurboMemory({ ... });
 * await memory.init();
 * const provider = createMastraMemory(memory);
 * ```
 */
export function createMastraMemory(
  memory: TurboMemory,
  options: CreateMastraMemoryOptions = {},
): MastraMemoryProvider {
  const recallLimit = options.recallLimit ?? 5;

  return {
    async remember(messages, context) {
      return memory.add(messages, {
        userId: context.userId,
        agentId: context.agentId,
        sessionId: context.sessionId,
      });
    },

    async recall(query, context) {
      const results = await memory.search(query, {
        userId: context.userId,
        agentId: context.agentId,
        sessionId: context.sessionId,
        limit: recallLimit,
      });
      return results.map((r) => r.memory.content).join("\n");
    },
  };
}

export type { Memory, Message, TurboMemory } from "turbomem";
