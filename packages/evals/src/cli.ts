import { Command } from "commander";
import { buildEvalConfig, type RunnerOptions } from "./runner.js";
import { runProductSuite } from "./suites/product.js";
import { locomoDataPathExists, runLocomoSuite } from "./suites/locomo.js";
import { buildSnapshot, syncLanding, writeSnapshot } from "./snapshot.js";
import { LATEST_RESULTS_PATH } from "./paths.js";
import type { LocomoSuiteResult, ProductSuiteResult } from "./results/schema.js";

const program = new Command();

program
  .name("turbomem-evals")
  .description("Production evals for turbomem: product goldens and LoCoMo.")
  .option("-s, --suite <name>", "product | locomo | all", "product")
  .option("--smoke", "Cheap subset. Product uses hash embeddings; LoCoMo uses 1 conversation / 20 questions.", false)
  .option("--limit <n>", "Cap LoCoMo questions per conversation", (v) => Number(v))
  .option("--out <path>", "Write snapshot JSON", LATEST_RESULTS_PATH)
  .option("--publish", "Mark this snapshot as the public freeze", false)
  .option("--sync-landing", "Copy snapshot to landing/src/data/evals.json when that tree exists", false)
  .option("--no-write", "Print JSON only; do not write a file");

program.action(async (opts: {
  suite: string;
  smoke: boolean;
  limit?: number;
  out: string;
  publish: boolean;
  syncLanding: boolean;
  write: boolean;
}) => {
  const suite = opts.suite.toLowerCase();
  if (suite !== "product" && suite !== "locomo" && suite !== "all") {
    throw new Error(`Unknown suite "${opts.suite}". Use product, locomo, or all.`);
  }

  const options: RunnerOptions = {
    smoke: Boolean(opts.smoke),
    qaLimit: Number.isFinite(opts.limit) ? opts.limit : undefined,
  };

  let product: ProductSuiteResult | null = null;
  let locomo: LocomoSuiteResult | null = null;

  if (suite === "product" || suite === "all") {
    console.error("Running product suite…");
    product = await runProductSuite(options);
  }

  if (suite === "locomo" || suite === "all") {
    if (!locomoDataPathExists()) {
      console.error("Skipping LoCoMo (dataset missing). Run: pnpm --filter @turbomem/evals download-locomo");
    } else if (!process.env.OPENAI_API_KEY) {
      console.error("Skipping LoCoMo (OPENAI_API_KEY not set).");
    } else {
      console.error("Running LoCoMo suite…");
      locomo = await runLocomoSuite(options);
    }
  }

  const config = buildEvalConfig({
    ...options,
    smoke: suite === "locomo" ? false : options.smoke,
  });

  const snapshot = buildSnapshot({
    config,
    product,
    locomo,
    published: Boolean(opts.publish) && locomo !== null && !options.smoke && config.embeddings === "openai",
    notes: unpublishedNote(Boolean(opts.publish), locomo, options.smoke, config.embeddings),
  });

  const json = JSON.stringify(snapshot, null, 2);
  console.log(json);

  if (opts.write !== false) {
    const path = writeSnapshot(snapshot, opts.out);
    console.error(`Wrote ${path}`);
    if (opts.syncLanding) {
      const landing = syncLanding(snapshot);
      if (landing) console.error(`Synced ${landing}`);
      else console.error("Landing evals.json path not found; skipped --sync-landing.");
    }
  }
});

function unpublishedNote(
  publish: boolean,
  locomo: LocomoSuiteResult | null,
  smoke: boolean,
  embeddings: string,
): string | undefined {
  if (publish && locomo && !smoke && embeddings === "openai") {
    return "Public snapshot. Headline LoCoMo number is official category-aware token F1, not LLM-as-judge.";
  }
  const parts: string[] = [];
  if (smoke) parts.push("Smoke run (not a public freeze).");
  if (embeddings === "hash") parts.push("Product retrieval used hash embeddings; do not cite as semantic recall.");
  if (!locomo) parts.push("LoCoMo was not run.");
  return parts.join(" ");
}

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
