import pkg from "../package.json";

/**
 * The published package version, read from package.json so it always matches
 * what `changeset version` bumps. Inlined at build time by tsup/esbuild.
 */
export const VERSION: string = pkg.version;
