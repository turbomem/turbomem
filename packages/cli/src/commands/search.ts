import type { Command } from "commander";
import { buildMemory } from "../config.js";
import { Loader } from "../loader.js";
import { printError, renderSearchResults } from "../output.js";
import { addScopeOptions, getOverrides, getScope, type ScopeOptions } from "./helpers.js";

interface SearchOptions extends ScopeOptions {
  limit?: string;
}

export function registerSearch(program: Command): void {
  const cmd = program
    .command("search")
    .description("Semantic search over stored memories")
    .argument("<query...>", "what to search for")
    .option("-l, --limit <n>", "maximum number of results", "10");

  addScopeOptions(cmd).action(async (queryParts: string[], opts: SearchOptions, command: Command) => {
    const query = queryParts.join(" ").trim();
    const limit = Number.parseInt(opts.limit ?? "10", 10);
    const scope = getScope(opts);
    const loader = new Loader();
    try {
      const { memory } = await buildMemory(getOverrides(command));
      loader.start("searching");
      const results = await memory.search(query, { ...scope, limit });
      loader.stop();
      console.log(renderSearchResults(results));
      await memory.close();
    } catch (err) {
      loader.stop();
      printError(err);
      process.exitCode = 1;
    }
  });
}
