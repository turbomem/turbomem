#!/usr/bin/env node
/**
 * Pre-submission checks for turbomem.mcpb (Connectors Directory).
 * Run: node scripts/verify-mcpb.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const mcpbPath = join(packageDir, "turbomem.mcpb");
const manifestPath = join(packageDir, "manifest.json");

const REQUIRED_TOOLS = [
  "remember",
  "recall",
  "list_memories",
  "forget",
  "forget_everything",
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

if (!existsSync(mcpbPath)) {
  fail(`Missing ${mcpbPath} — run pnpm pack:mcpb first`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!manifest.icon) fail("manifest.json missing icon");
if (!manifest.documentation?.includes("/mcp")) fail("documentation must point to /mcp");
if (!manifest.privacy_policies?.includes("https://turbomem.dev/privacy")) {
  fail("privacy_policies must include https://turbomem.dev/privacy");
}

const toolNames = manifest.tools?.map((t) => t.name) ?? [];
for (const name of REQUIRED_TOOLS) {
  if (!toolNames.includes(name)) fail(`manifest missing tool: ${name}`);
}
ok(`manifest lists ${REQUIRED_TOOLS.length} tools`);

const listing = execSync(`unzip -l "${mcpbPath}"`, { encoding: "utf8" });
if (!listing.includes("icon.png")) fail("mcpb bundle missing icon.png");
if (!listing.includes("manifest.json")) fail("mcpb bundle missing manifest.json");
if (!listing.includes("server/index.js")) fail("mcpb bundle missing server/index.js");
ok("mcpb bundle contains icon, manifest, and server entry");

const bundledManifest = JSON.parse(
  execSync(`unzip -p "${mcpbPath}" manifest.json`, { encoding: "utf8" }),
);
if (bundledManifest.version !== manifest.version) {
  fail(`bundled version ${bundledManifest.version} != package ${manifest.version}`);
}
ok(`version ${manifest.version} consistent in bundle`);

console.log("\nAll automated mcpb checks passed.");
console.log("Manual QA still required: install turbomem.mcpb in Claude Desktop and exercise every tool.");
