import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: false,
    clean: true,
    sourcemap: true,
    treeshake: true,
    external: ["turbomem", "openai"],
  },
  {
    entry: { cli: "src/cli.ts", "download-locomo": "src/download-locomo.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    sourcemap: true,
    treeshake: true,
    banner: { js: "#!/usr/bin/env node" },
    external: ["turbomem", "openai"],
  },
]);
