import { defineConfig } from "tsup";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(fileURLToPath(import.meta.url), "..");

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    treeshake: true,
    external: ["better-sqlite3", "sqlite-vec", "@upstash/vector"],
  },
  {
    entry: ["src/browser.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    sourcemap: true,
    treeshake: true,
    external: ["better-sqlite3", "sqlite-vec", "@upstash/vector"],
    esbuildPlugins: [
      {
        name: "pglite-disk-browser-stub",
        setup(build) {
          build.onResolve({ filter: /pglite-disk\.js$/ }, () => ({
            path: join(rootDir, "src/storage/pglite-disk.stub.ts"),
          }));
        },
      },
    ],
  },
]);
