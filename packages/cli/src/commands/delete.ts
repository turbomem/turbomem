import type { Command } from "commander";
import { confirm, isCancel } from "@clack/prompts";
import { buildMemory } from "../config.js";
import { Loader } from "../loader.js";
import { printError } from "../output.js";
import { theme } from "../theme.js";
import { addScopeOptions, getOverrides, getScope, type ScopeOptions } from "./helpers.js";

interface DeleteOptions extends ScopeOptions {
  all?: boolean;
  yes?: boolean;
}

export function registerDelete(program: Command): void {
  const cmd = program
    .command("delete")
    .alias("rm")
    .description("Delete a memory by id, or every memory in a scope with --all")
    .argument("[id]", "the memory id to delete")
    .option("--all", "delete every memory matching the scope")
    .option("-y, --yes", "skip the confirmation prompt");

  addScopeOptions(cmd).action(async (id: string | undefined, opts: DeleteOptions, command: Command) => {
    const scope = getScope(opts);
    const loader = new Loader();

    if (!opts.all && !id) {
      printError("Provide a memory id, or use --all to clear a scope.");
      process.exitCode = 1;
      return;
    }

    try {
      if (opts.all && !opts.yes) {
        const scopeLabel = scope.userId || scope.agentId || scope.sessionId ? "this scope" : "ALL scopes";
        const ok = await confirm({ message: `Delete every memory in ${scopeLabel}?` });
        if (isCancel(ok) || !ok) {
          console.log(theme.dim("Aborted."));
          return;
        }
      }

      const { memory } = await buildMemory(getOverrides(command));
      loader.start("deleting");
      if (opts.all) {
        await memory.deleteAll(scope);
        loader.succeed("Deleted all matching memories.");
      } else {
        await memory.delete(id!);
        loader.succeed(`Deleted memory ${id}.`);
      }
      await memory.close();
    } catch (err) {
      loader.stop();
      printError(err);
      process.exitCode = 1;
    }
  });
}
