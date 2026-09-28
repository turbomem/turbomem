import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gitSha, isoDate } from "./git.js";
import { LANDING_EVALS_JSON, LATEST_RESULTS_PATH, PACKAGE_ROOT, RESULTS_DIR } from "./paths.js";
import { EvalSnapshotSchema, type EvalConfig, type EvalSnapshot } from "./results/schema.js";
import type { LocomoSuiteResult, ProductSuiteResult } from "./results/schema.js";

export interface SnapshotInput {
  config: EvalConfig;
  product: ProductSuiteResult | null;
  locomo: LocomoSuiteResult | null;
  published: boolean;
  notes?: string;
}

export function buildSnapshot(input: SnapshotInput): EvalSnapshot {
  const snapshot: EvalSnapshot = {
    schemaVersion: 1,
    date: isoDate(),
    gitSha: gitSha(),
    published: input.published,
    config: input.config,
    suites: {
      product: input.product,
      locomo: input.locomo,
    },
    notes: input.notes,
  };
  return EvalSnapshotSchema.parse(snapshot);
}

export function writeSnapshot(snapshot: EvalSnapshot, outPath = LATEST_RESULTS_PATH): string {
  mkdirSync(dirname(outPath), { recursive: true });
  mkdirSync(RESULTS_DIR, { recursive: true });
  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  writeFileSync(outPath, json);
  return outPath;
}

export function syncLanding(snapshot: EvalSnapshot): string | null {
  const landingRoot = join(PACKAGE_ROOT, "..", "..", "..", "landing");
  if (!existsSync(landingRoot)) return null;
  mkdirSync(dirname(LANDING_EVALS_JSON), { recursive: true });
  writeFileSync(LANDING_EVALS_JSON, `${JSON.stringify(snapshot, null, 2)}\n`);
  return LANDING_EVALS_JSON;
}
