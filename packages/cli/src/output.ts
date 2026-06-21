import chalk from "chalk";
import type { Memory, MemoryScope, MemorySearchResult } from "turbomem";
import { gradientText, sampleGradient, theme } from "./theme.js";

/** Print the gradient brand banner. */
export function printBanner(): void {
  const word = gradientText("turbomem");
  process.stdout.write(`\n  ${chalk.bold(word)}  ${theme.dim("local-first agent memory")}\n\n`);
}

/** First segment of a UUID, for compact display. */
export function shortId(id: string): string {
  return id.split("-")[0] ?? id;
}

/** Human-readable scope summary, e.g. `user:alice · session:s1`. */
export function formatScope(scope: MemoryScope): string {
  const parts: string[] = [];
  if (scope.userId) parts.push(`user:${scope.userId}`);
  if (scope.agentId) parts.push(`agent:${scope.agentId}`);
  if (scope.sessionId) parts.push(`session:${scope.sessionId}`);
  return parts.length ? parts.join(" · ") : "global";
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleString();
}

/** Color a similarity score from dark (low) to light (high) on the brand ramp. */
function scoreBadge(score: number): string {
  const color = sampleGradient(Math.max(0, Math.min(1, score)));
  return chalk.hex(color).bold(score.toFixed(3));
}

/** Render a single stored memory as an indented block. */
export function renderMemory(memory: Memory): string {
  const meta = `${theme.dim(shortId(memory.id))}  ${theme.dim(formatScope(memory))}  ${theme.dim(
    formatDate(memory.createdAt),
  )}`;
  return `  ${theme.accent("•")} ${memory.content}\n    ${meta}`;
}

/** Render a list of memories (e.g. from `list`). */
export function renderMemoryList(memories: Memory[]): string {
  if (memories.length === 0) return renderEmpty("No memories stored for this scope yet.");
  const header = theme.label(`Memories (${memories.length})`);
  return `${header}\n${memories.map(renderMemory).join("\n")}`;
}

/** Render ranked search results with colored similarity scores. */
export function renderSearchResults(results: MemorySearchResult[]): string {
  if (results.length === 0) return renderEmpty("No matching memories found.");
  const header = theme.label(`Results (${results.length})`);
  const rows = results
    .map(({ memory, score }) => {
      const meta = `${theme.dim(shortId(memory.id))}  ${theme.dim(formatScope(memory))}`;
      return `  ${scoreBadge(score)}  ${memory.content}\n          ${meta}`;
    })
    .join("\n");
  return `${header}\n${rows}`;
}

/** Render created memories (from `add` / `fact`). */
export function renderCreated(memories: Memory[]): string {
  if (memories.length === 0) {
    return theme.warn("No memorable facts were extracted.");
  }
  const header = theme.label(`Remembered ${memories.length} fact${memories.length === 1 ? "" : "s"}`);
  const rows = memories.map((m) => `  ${theme.success("+")} ${m.content}`).join("\n");
  return `${header}\n${rows}`;
}

/** Dimmed empty-state message. */
export function renderEmpty(message: string): string {
  return theme.dim(message);
}

/** Print an error in the brand error color. */
export function printError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${theme.error("✘")} ${message}\n`);
}
