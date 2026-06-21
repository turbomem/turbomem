import { Command } from "commander";
import { registerAdd } from "./commands/add.js";
import { registerConfig } from "./commands/config.js";
import { registerDelete } from "./commands/delete.js";
import { registerInit } from "./commands/init.js";
import { registerList } from "./commands/list.js";
import { registerSearch } from "./commands/search.js";
import { printError } from "./output.js";
import { startRepl } from "./repl.js";

const VERSION = "0.2.1";

const program = new Command();

program
  .name("turbomem")
  .description("Local-first agent memory — add, search, and manage memories from your terminal.")
  .version(VERSION, "-v, --version", "print the version")
  .option("--data-dir <path>", "override the data directory")
  .action(async () => {
    // No subcommand: launch the interactive shell.
    await startRepl({ dataDir: program.opts<{ dataDir?: string }>().dataDir });
  });

registerInit(program);
registerAdd(program);
registerSearch(program);
registerList(program);
registerDelete(program);
registerConfig(program);

program
  .command("shell")
  .alias("repl")
  .description("Start the interactive turbomem shell")
  .action(async (_opts: unknown, command: Command) => {
    await startRepl({ dataDir: command.parent?.opts<{ dataDir?: string }>().dataDir });
  });

program.parseAsync(process.argv).catch((err) => {
  printError(err);
  process.exitCode = 1;
});
