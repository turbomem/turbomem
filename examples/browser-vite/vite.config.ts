import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
});
