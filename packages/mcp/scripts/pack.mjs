// Assemble a self-contained .mcpb bundle for Claude Desktop.
//
// Steps:
//   1. Build the server (tsup -> dist/index.js, fully bundled except externals).
//   2. Stage a clean build/ dir: compiled server + manifest.json.
//   3. Write a build/package.json pinned to concrete versions and run a
//      production `npm install` so external deps land in build/node_modules.
//   4. Run `mcpb pack` to zip build/ into turbomem.mcpb.

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = join(packageDir, "..", "..");
const buildDir = join(packageDir, "build");
const outFile = join(packageDir, "turbomem.mcpb");

function run(command, cwd = packageDir) {
  console.log(`\n$ ${command}`);
  execSync(command, { cwd, stdio: "inherit" });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const pkg = readJson(join(packageDir, "package.json"));
const corePkg = readJson(join(rootDir, "packages", "core", "package.json"));

console.log("Building server...");
run("npm run build");

const distEntry = join(packageDir, "dist", "index.js");
if (!existsSync(distEntry)) {
  throw new Error("Expected dist/index.js after build — check the tsup config.");
}

console.log("Staging build directory...");
rmSync(buildDir, { recursive: true, force: true });
mkdirSync(join(buildDir, "server"), { recursive: true });

// Copy the whole compiled output so any sourcemaps travel with it.
cpSync(join(packageDir, "dist"), join(buildDir, "server"), { recursive: true });
cpSync(join(packageDir, "manifest.json"), join(buildDir, "manifest.json"));

// Resolve runtime dependency versions. turbomem is a workspace package, so pin
// it to the current core version instead of the unresolvable "workspace:*".
//
// The bundle ships @anthropic-ai/sdk (small, HTTP-only) so the OpenAI, Google,
// and Anthropic extraction providers all work out of the box. It deliberately
// omits @huggingface/transformers (large, native onnxruntime/sharp deps): OpenAI
// and Google handle their own embeddings over HTTP, so the bundle stays small.
// Anthropic has no embedding API, so semantic search with the Anthropic provider
// needs the local WASM model, available via the manual `npm install
// @huggingface/transformers` step documented in the README.
const dependencies = {
  turbomem: `^${corePkg.version}`,
  "@modelcontextprotocol/sdk": pkg.dependencies["@modelcontextprotocol/sdk"],
  zod: pkg.dependencies.zod,
  "@anthropic-ai/sdk": pkg.peerDependencies["@anthropic-ai/sdk"],
};

writeFileSync(
  join(buildDir, "package.json"),
  JSON.stringify(
    {
      name: "turbomem-mcpb",
      version: pkg.version,
      private: true,
      type: "module",
      dependencies,
    },
    null,
    2,
  ) + "\n",
);

console.log("Installing production dependencies into the bundle...");
run("npm install --omit=dev --no-audit --no-fund --loglevel=error", buildDir);

console.log("Packing .mcpb...");
rmSync(outFile, { force: true });
run(`npx --yes @anthropic-ai/mcpb pack "${buildDir}" "${outFile}"`);

console.log(`\nDone. Created ${outFile}`);
console.log("Double-click it (or drag it into Claude Desktop → Settings → Extensions) to install.");
