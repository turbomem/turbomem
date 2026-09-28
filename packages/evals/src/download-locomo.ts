import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { LOCOMO_DATA_PATH } from "./paths.js";

const LOCOMO_URL =
  "https://raw.githubusercontent.com/snap-research/locomo/main/data/locomo10.json";

async function main(): Promise<void> {
  console.log(`Downloading LoCoMo from ${LOCOMO_URL}`);
  const res = await fetch(LOCOMO_URL);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.text();
  JSON.parse(body);
  mkdirSync(dirname(LOCOMO_DATA_PATH), { recursive: true });
  writeFileSync(LOCOMO_DATA_PATH, body);
  console.log(`Wrote ${LOCOMO_DATA_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
