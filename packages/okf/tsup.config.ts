import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    external: ["turbomem"],
  },
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    banner: { js: "#!/usr/bin/env node" },
    external: ["turbomem"],
  },
]);
