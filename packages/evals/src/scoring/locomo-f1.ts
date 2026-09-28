import { porterStem } from "./porter.js";
import { LOCOMO_CATEGORY_NAMES, type LocomoCategoryId } from "../results/schema.js";

const PUNCTUATION = new Set(`!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`.split(""));
const ARTICLES = /\b(a|an|the|and)\b/g;

/** LoCoMo `normalize_answer` (comma strip, lower, drop punctuation, drop a/an/the/and). */
export function normalizeAnswer(s: string): string {
  const strippedCommas = s.replace(/,/g, "");
  const lower = strippedCommas.toLowerCase();
  const noPunc = [...lower].filter((ch) => !PUNCTUATION.has(ch)).join("");
  const noArticles = noPunc.replace(ARTICLES, " ");
  return noArticles.split(/\s+/).filter(Boolean).join(" ");
}

function tokens(s: string): string[] {
  return normalizeAnswer(s).split(/\s+/).filter(Boolean).map(porterStem);
}

/**
 * Token-level F1 after Porter stemming. Port of LoCoMo `f1_score`.
 */
export function locomoF1Score(prediction: string, groundTruth: string): number {
  const pred = tokens(prediction);
  const gold = tokens(groundTruth);
  if (pred.length === 0 || gold.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const t of gold) counts.set(t, (counts.get(t) ?? 0) + 1);

  let same = 0;
  for (const t of pred) {
    const n = counts.get(t) ?? 0;
    if (n > 0) {
      same++;
      counts.set(t, n - 1);
    }
  }
  if (same === 0) return 0;
  const precision = same / pred.length;
  const recall = same / gold.length;
  return (2 * precision * recall) / (precision + recall);
}

/**
 * Multi-answer F1: comma-split prediction and gold, mean of per-gold max F1.
 * Port of LoCoMo `f1` (category 1).
 */
export function locomoF1Multi(prediction: string, groundTruth: string): number {
  const predictions = prediction.split(",").map((p) => p.trim()).filter(Boolean);
  const golds = groundTruth.split(",").map((g) => g.trim()).filter(Boolean);
  if (golds.length === 0) return 0;
  const preds = predictions.length > 0 ? predictions : [prediction];
  const perGold = golds.map((gt) => Math.max(...preds.map((p) => locomoF1Score(p, gt))));
  return perGold.reduce((a, b) => a + b, 0) / perGold.length;
}

const REFUSAL_MARKERS = ["no information available", "not mentioned"] as const;

export function locomoAdversarialScore(prediction: string): number {
  const lower = prediction.toLowerCase();
  return REFUSAL_MARKERS.some((m) => lower.includes(m)) ? 1 : 0;
}

/**
 * Category-aware LoCoMo QA score. Dataset IDs (not the paper's numbered list):
 * 1 multi-hop, 2 temporal, 3 open-domain, 4 single-hop, 5 adversarial.
 */
export function scoreLocomoQa(prediction: string, gold: string, category: LocomoCategoryId): number {
  if (category === 5) return locomoAdversarialScore(prediction);
  let answer = gold;
  if (category === 3) answer = gold.split(";")[0].trim();
  if (category === 1) return locomoF1Multi(prediction, answer);
  return locomoF1Score(prediction, answer);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function categoryName(id: LocomoCategoryId): string {
  return LOCOMO_CATEGORY_NAMES[id];
}
