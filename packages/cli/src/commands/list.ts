import type { Command } from "commander";
import { buildMemory } from "../config.js";
import { Loader } from "../loader.js";
import { printError, renderMemoryList } from "../output.js";
import { addScopeOptions, getOverrides, getScope, type ScopeOptions } from "./helpers.js";

export function registerList(program: Command): void {
  const cmd = program
    .command("list")
    .alias("ls")
    .description("List all stored memories for a scope");

  addScopeOptions(cmd).action(async (opts: ScopeOptions, command: Command) => {
    const scope = getScope(opts);
    const loader = new Loader();
    try {
      const { memory } = await buildMemory(getOverrides(command));
      loader.start("loading");
      const memories = await memory.getAll(scope);
      loader.stop();
      console.log(renderMemoryList(memories));
      await memory.close();
    } catch (err) {
      loader.stop();
      printError(err);
      process.exitCode = 1;
    }
  });
}
