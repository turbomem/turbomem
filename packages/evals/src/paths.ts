import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Package root (`packages/evals`), whether running from `src/` or `dist/`. */
export const PACKAGE_ROOT = join(here, "..");

export const DATASETS_DIR = join(PACKAGE_ROOT, "datasets");
export const PRODUCT_DATASETS_DIR = join(DATASETS_DIR, "product");
export const LOCOMO_DATASETS_DIR = join(DATASETS_DIR, "locomo");
export const LOCOMO_DATA_PATH = join(LOCOMO_DATASETS_DIR, "locomo10.json");
export const RESULTS_DIR = join(PACKAGE_ROOT, "results");
export const LATEST_RESULTS_PATH = join(RESULTS_DIR, "latest.json");

/** Sibling marketing site, when this repo lives next to `landing/`. */
export const LANDING_EVALS_JSON = join(
  PACKAGE_ROOT,
  "..",
  "..",
  "..",
  "landing",
  "src",
  "data",
  "evals.json",
);
