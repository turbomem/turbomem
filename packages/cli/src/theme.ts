import chalk from "chalk";

/**
 * The turbomem brand palette, built around the product primary `#A8B1FF`.
 * Ordered dark -> light so it can be used directly as gradient stops.
 */
export const PALETTE = {
  darkest: "#3D47B8",
  darker: "#4F5BD5",
  dark: "#6B78F0",
  base: "#A8B1FF",
  light: "#C2C9FF",
  lighter: "#DDE1FF",
  lightest: "#EEF0FF",
} as const;

/** Gradient stops from dark to light, used by the animated loader. */
export const GRADIENT_STOPS = [
  PALETTE.darkest,
  PALETTE.darker,
  PALETTE.dark,
  PALETTE.base,
  PALETTE.light,
  PALETTE.lighter,
  PALETTE.lightest,
] as const;

interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Parse a `#rrggbb` hex string into its RGB components. */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function toHex(value: number): string {
  return Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");
}

/**
 * Linearly interpolate between two hex colors. `t` is clamped to `[0, 1]`.
 */
export function lerpHex(from: string, to: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return `#${toHex(a.r + (b.r - a.r) * clamped)}${toHex(a.g + (b.g - a.g) * clamped)}${toHex(
    a.b + (b.b - a.b) * clamped,
  )}`;
}

/**
 * Sample the brand gradient at position `t` in `[0, 1]`, interpolating between
 * adjacent stops for a smooth blend.
 */
export function sampleGradient(t: number, stops: readonly string[] = GRADIENT_STOPS): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (stops.length === 1) return stops[0];
  const scaled = clamped * (stops.length - 1);
  const index = Math.floor(scaled);
  if (index >= stops.length - 1) return stops[stops.length - 1];
  return lerpHex(stops[index], stops[index + 1], scaled - index);
}

/** Color a string with a left-to-right brand gradient across its characters. */
export function gradientText(text: string, stops: readonly string[] = GRADIENT_STOPS): string {
  const chars = [...text];
  if (chars.length <= 1) return chalk.hex(PALETTE.base)(text);
  return chars
    .map((char, i) => chalk.hex(sampleGradient(i / (chars.length - 1), stops))(char))
    .join("");
}

/** Reusable chalk wrappers for consistent styling across the CLI. */
export const theme = {
  accent: chalk.hex(PALETTE.base),
  accentBold: chalk.hex(PALETTE.base).bold,
  dark: chalk.hex(PALETTE.dark),
  light: chalk.hex(PALETTE.lighter),
  dim: chalk.dim,
  success: chalk.hex("#7CE38B"),
  error: chalk.hex("#FF7A7A"),
  warn: chalk.hex("#FFD479"),
  label: chalk.hex(PALETTE.light).bold,
};
