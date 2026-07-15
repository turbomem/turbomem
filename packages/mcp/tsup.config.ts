import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  treeshake: true,
  banner: { js: "#!/usr/bin/env node" },
  external: [
    "turbomem",
    "@modelcontextprotocol/sdk",
    "@anthropic-ai/sdk",
    "@huggingface/transformers",
  ],
});
