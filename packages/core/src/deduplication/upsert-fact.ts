import type {
  EmbeddingAdapter,
  Memory,
  MemoryScope,
  MemorySearchResult,
  StorageAdapter,
} from "../types.js";
import { isMoreSpecific } from "./specificity.js";
import type { Merger } from "./merger.js";
import type { ResolvedDeduplicationConfig } from "./resolve-config.js";

async function insertFact(
  storage: StorageAdapter,
  fact: string,
  embedding: number[],
  scope: MemoryScope,
): Promise<Memory> {
  return storage.insert({
    content: fact,
    embedding,
    userId: scope.userId,
    agentId: scope.agentId,
    sessionId: scope.sessionId,
    metadata: {},
  });
}

async function smartReplace(
  storage: StorageAdapter,
  primary: MemorySearchResult,
  fact: string,
  embedding: number[],
): Promise<Memory> {
  if (isMoreSpecific(fact, primary.memory.content)) {
    return storage.update(primary.memory.id, { content: fact, embedding });
  }
  return primary.memory;
}

export async function upsertFact(
  storage: StorageAdapter,
  embeddingAdapter: EmbeddingAdapter,
  merger: Merger,
  config: ResolvedDeduplicationConfig,
  fact: string,
  embedding: number[],
  scope: MemoryScope,
): Promise<Memory> {
  if (!config.enabled) {
    return insertFact(storage, fact, embedding, scope);
  }

  const results = await storage.search(embedding, scope, config.mergeTopK);
  const matches = results.filter((r) => r.score >= config.threshold);

  if (matches.length === 0) {
    return insertFact(storage, fact, embedding, scope);
  }

  const primary = matches[0];
  const extras = matches.slice(1);

  if (config.strategy === "skip") {
    return primary.memory;
  }

  if (config.strategy === "replace") {
    return smartReplace(storage, primary, fact, embedding);
  }

  // merge strategy
  try {
    const existingFacts = matches.map((m) => m.memory.content);
    const merged = await merger.mergeMany(existingFacts, fact);
    const mergedEmbedding = await embeddingAdapter.embed(merged);
    const updated = await storage.update(primary.memory.id, {
      content: merged,
      embedding: mergedEmbedding,
    });

    for (const extra of extras) {
      await storage.delete(extra.memory.id);
    }

    return updated;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[turbomem] Memory merge failed, falling back to smart replace: ${(error as Error).message}`,
    );
    return smartReplace(storage, primary, fact, embedding);
  }
}
