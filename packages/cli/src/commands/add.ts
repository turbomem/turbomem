import type { Command } from "commander";
import { buildMemory } from "../config.js";
import { Loader } from "../loader.js";
import { printError, renderCreated } from "../output.js";
import { addScopeOptions, getOverrides, getScope, type ScopeOptions } from "./helpers.js";

interface AddOptions extends ScopeOptions {
  fact?: boolean;
}

export function registerAdd(program: Command): void {
  const cmd = program
    .command("add")
    .description("Add a memory from text (LLM extracts facts by default)")
    .argument("<text...>", "the text to remember")
    .option("-f, --fact", "store the text verbatim as a fact, skipping LLM extraction");

  addScopeOptions(cmd).action(async (textParts: string[], opts: AddOptions, command: Command) => {
    const text = textParts.join(" ").trim();
    const scope = getScope(opts);
    const loader = new Loader();
    try {
      const { memory } = await buildMemory(getOverrides(command));
      loader.start(opts.fact ? "storing" : "extracting");
      const created = opts.fact
        ? await memory.addFacts([text], scope)
        : await memory.add([{ role: "user", content: text }], scope);
      loader.stop();
      console.log(renderCreated(created));
      await memory.close();
    } catch (err) {
      loader.stop();
      printError(err);
      process.exitCode = 1;
    }
  });
}
