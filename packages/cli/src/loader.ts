import chalk from "chalk";
import { GRADIENT_STOPS, sampleGradient, theme } from "./theme.js";

const WORD = "turbomem";
const FRAME_MS = 80;
/** Width (in letters) of the bright band that sweeps across the word. */
const BAND_WIDTH = 3;

const HIDE_CURSOR = "\x1B[?25l";
const SHOW_CURSOR = "\x1B[?25h";
const CLEAR_LINE = "\x1B[2K";

/**
 * An animated, Turbo-repo-style loader that renders the word `turbomem` while a
 * bright band of the brand gradient sweeps from left to right across its
 * letters. Falls back to plain status lines when stdout is not a TTY.
 */
/** Frames a single status label lingers before rotating to the next one. */
const LABEL_HOLD_FRAMES = 14;

export class Loader {
  private timer: NodeJS.Timeout | null = null;
  private frame = 0;
  private labels: string[] = [];
  private readonly isTTY: boolean;

  constructor(private readonly stream: NodeJS.WriteStream = process.stdout) {
    this.isTTY = Boolean(stream.isTTY);
  }

  /**
   * Begin the animation with an optional dim status label. Pass an array to
   * cycle through hints (e.g. `["searching", "scoring matches"]`) for longer
   * operations.
   */
  start(label: string | string[] = ""): this {
    this.labels = (Array.isArray(label) ? label : [label]).filter(Boolean);
    this.frame = 0;

    if (!this.isTTY) {
      this.stream.write(`${theme.accent(WORD)} ${theme.dim(this.labels[0] ?? "")}\n`);
      return this;
    }

    if (this.timer) return this;
    this.stream.write(HIDE_CURSOR);
    this.render();
    this.timer = setInterval(() => {
      this.frame += 1;
      this.render();
    }, FRAME_MS);
    return this;
  }

  /** Update the status label(s) without restarting the animation. */
  setLabel(label: string | string[]): void {
    this.labels = (Array.isArray(label) ? label : [label]).filter(Boolean);
  }

  /** The status hint shown for the current frame, rotating when several exist. */
  private currentLabel(): string {
    if (this.labels.length <= 1) return this.labels[0] ?? "";
    const index = Math.floor(this.frame / LABEL_HOLD_FRAMES) % this.labels.length;
    return this.labels[index];
  }

  private render(): void {
    const chars = [...WORD];
    const total = chars.length + BAND_WIDTH;
    // The bright head sweeps across the word and wraps around for a loop.
    const head = this.frame % total;
    const colored = chars
      .map((char, i) => {
        const distance = Math.abs(i - head);
        // Within the band: bright (light end). Outside: fades to dark.
        const proximity = Math.max(0, 1 - distance / BAND_WIDTH);
        return chalk.hex(sampleGradient(proximity, GRADIENT_STOPS))(char);
      })
      .join("");
    const label = this.currentLabel();
    const suffix = label ? ` ${theme.dim(label + "…")}` : "";
    this.stream.write(`\r${CLEAR_LINE}${colored}${suffix}`);
  }

  /** Stop the animation and clear the line, leaving nothing behind. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.isTTY) {
      this.stream.write(`\r${CLEAR_LINE}${SHOW_CURSOR}`);
    }
  }

  /** Stop the loader and print a success line. */
  succeed(message: string): void {
    this.stop();
    this.stream.write(`${theme.success("✔")} ${message}\n`);
  }

  /** Stop the loader and print a failure line. */
  fail(message: string): void {
    this.stop();
    this.stream.write(`${theme.error("✘")} ${message}\n`);
  }
}

/**
 * Run an async task while showing the loader, succeeding or failing
 * automatically. Returns the task's resolved value.
 */
export async function withLoader<T>(
  label: string,
  task: () => Promise<T>,
  messages: { success?: (value: T) => string; fail?: string } = {},
): Promise<T> {
  const loader = new Loader().start(label);
  try {
    const value = await task();
    if (messages.success) loader.succeed(messages.success(value));
    else loader.stop();
    return value;
  } catch (err) {
    loader.fail(messages.fail ?? (err instanceof Error ? err.message : String(err)));
    throw err;
  }
}
