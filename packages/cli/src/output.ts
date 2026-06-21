import chalk from "chalk";
import type { Memory, MemoryScope, MemorySearchResult } from "turbomem";
import { gradientText, PALETTE, sampleGradient, theme } from "./theme.js";

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1B\[[0-9;]*m/g;

/** Strip ANSI color escape codes from a string. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

/** Visible width of a string, ignoring ANSI color codes. */
export function visibleWidth(text: string): number {
  return [...stripAnsi(text)].length;
}

/** Truncate to `max` visible characters, appending an ellipsis when clipped. */
export function truncate(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

/** Usable content width for boxed output, clamped to a comfortable range. */
function panelWidth(): number {
  const cols = process.stdout.columns || 80;
  return Math.max(24, Math.min(cols, 100) - 12);
}

interface BoxOptions {
  /** Border (and title) color as a hex string. Defaults to the brand base. */
  color?: string;
  /** Horizontal space between the border and content. Defaults to 2. */
  padding?: number;
  /** Left indent applied to the whole box. Defaults to 2. */
  margin?: number;
  /** Optional title rendered into the top border. */
  title?: string;
}

/**
 * Draw a rounded rectangle around pre-colored `lines`, measuring visible width
 * so ANSI color codes never throw off the border alignment.
 */
export function box(lines: string[], opts: BoxOptions = {}): string {
  const { color = PALETTE.base, padding = 2, margin = 2 } = opts;
  const paint = chalk.hex(color);
  const indent = " ".repeat(margin);

  const titleWidth = opts.title ? visibleWidth(opts.title) + 4 : 0;
  const contentWidth = Math.max(0, ...lines.map(visibleWidth), titleWidth - padding * 2);
  const innerWidth = contentWidth + padding * 2;

  let top: string;
  if (opts.title) {
    const titleSegment = ` ${paint.bold(opts.title)} `;
    const dashes = innerWidth - visibleWidth(titleSegment) - 1;
    top = `${paint("╭─")}${titleSegment}${paint("─".repeat(Math.max(0, dashes)))}${paint("╮")}`;
  } else {
    top = paint(`╭${"─".repeat(innerWidth)}╮`);
  }
  const bottom = paint(`╰${"─".repeat(innerWidth)}╯`);

  const body = lines.map((line) => {
    const fill = " ".repeat(Math.max(0, contentWidth - visibleWidth(line)));
    return `${indent}${paint("│")}${" ".repeat(padding)}${line}${fill}${" ".repeat(padding)}${paint("│")}`;
  });

  return [`${indent}${top}`, ...body, `${indent}${bottom}`].join("\n");
}

/** Context shown alongside the brand line in the welcome panel. */
export interface BannerInfo {
  version?: string;
  embeddings?: string;
  extraction?: string;
  dataDir?: string;
  /** When true, prompt the user to run `turbomem init`. */
  needsInit?: boolean;
}

/** Print the gradient brand welcome panel with resolved runtime context. */
export function printBanner(info: BannerInfo = {}): void {
  const brandLine = `${chalk.bold(gradientText("turbomem"))}  ${theme.dim("local-first agent memory")}`;
  const lines: string[] = [brandLine];

  const rows: Array<[string, string]> = [];
  if (info.version) rows.push(["version", info.version]);
  if (info.embeddings) rows.push(["embeddings", info.embeddings]);
  if (info.extraction) rows.push(["extraction", info.extraction]);
  if (info.dataDir) rows.push(["data dir", info.dataDir]);

  if (rows.length) {
    lines.push("");
    const labelWidth = Math.max(...rows.map(([key]) => key.length));
    for (const [key, value] of rows) {
      lines.push(`${theme.dim(key.padEnd(labelWidth))}   ${theme.light(value)}`);
    }
  }

  lines.push("");
  if (info.needsInit) {
    lines.push(`${theme.warn("›")} Run ${theme.accent("turbomem init")} to get started.`);
  } else {
    lines.push(
      `${theme.dim("Type")} ${theme.accent("/help")} ${theme.dim("for commands,")} ${theme.accent(
        "/exit",
      )} ${theme.dim("to quit.")}`,
    );
  }

  process.stdout.write(`\n${box(lines)}\n\n`);
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

/** Compact relative time, e.g. `2m ago`, `3d ago`. */
export function relativeTime(date: Date): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const seconds = Math.max(0, Math.round(diffMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/** Color a similarity score from dark (low) to light (high) on the brand ramp. */
function scoreBadge(score: number): string {
  const color = sampleGradient(Math.max(0, Math.min(1, score)));
  return chalk.hex(color).bold(score.toFixed(3));
}

/** A small gradient relevance meter, e.g. `█████░░░`. */
function scoreBar(score: number, width = 8): string {
  const clamped = Math.max(0, Math.min(1, score));
  const filled = Math.round(clamped * width);
  const color = sampleGradient(clamped);
  return `${chalk.hex(color)("█".repeat(filled))}${theme.dim("░".repeat(width - filled))}`;
}

/** Dimmed metadata line shared by list/search rows. */
function metaLine(memory: Memory, indent: number): string {
  const meta = `${shortId(memory.id)} · ${formatScope(memory)} · ${relativeTime(memory.createdAt)}`;
  return theme.dim(`${" ".repeat(indent)}${meta}`);
}

/** Render a single stored memory as an indented block. */
export function renderMemory(memory: Memory): string {
  return `  ${theme.accent("•")} ${memory.content}\n${metaLine(memory, 4)}`;
}

/** Render a list of memories (e.g. from `list`) inside a brand panel. */
export function renderMemoryList(memories: Memory[]): string {
  if (memories.length === 0) {
    return renderEmpty('No memories stored for this scope yet. Try `add "..."` to remember something.');
  }
  const max = panelWidth();
  const lines: string[] = [theme.label(`Memories (${memories.length})`), ""];
  memories.forEach((memory, i) => {
    lines.push(`${theme.accent("•")} ${truncate(memory.content, max)}`);
    lines.push(metaLine(memory, 2));
    if (i < memories.length - 1) lines.push("");
  });
  return box(lines);
}

/** Render ranked search results with relevance bars inside a brand panel. */
export function renderSearchResults(results: MemorySearchResult[]): string {
  if (results.length === 0) {
    return renderEmpty("No matching memories found. Try a different query or `add` something first.");
  }
  const max = panelWidth() - 16;
  const lines: string[] = [theme.label(`Results (${results.length})`), ""];
  results.forEach(({ memory, score }, i) => {
    lines.push(`${scoreBar(score)}  ${scoreBadge(score)}  ${truncate(memory.content, max)}`);
    lines.push(metaLine(memory, 19));
    if (i < results.length - 1) lines.push("");
  });
  return box(lines);
}

/** Render created memories (from `add` / `fact`) inside a brand panel. */
export function renderCreated(memories: Memory[]): string {
  if (memories.length === 0) {
    return theme.warn("No memorable facts were extracted.");
  }
  const max = panelWidth();
  const header = theme.label(`Remembered ${memories.length} fact${memories.length === 1 ? "" : "s"}`);
  const lines = [header, "", ...memories.map((m) => `${theme.success("+")} ${truncate(m.content, max)}`)];
  return box(lines);
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
