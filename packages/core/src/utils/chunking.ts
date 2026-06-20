import type { Message } from "../types.js";

/**
 * Split an array into fixed-size chunks. Useful for batching embedding requests
 * so we respect provider request limits.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error("Chunk size must be a positive integer");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Render a list of messages into a single plain-text transcript suitable for
 * feeding to an extraction LLM.
 */
export function formatTranscript(messages: Message[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}
