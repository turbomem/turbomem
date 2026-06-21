import readline from "node:readline";
import type { MemoryScope } from "turbomem";
import { buildMemory, type ConfigOverrides } from "./config.js";
import { Loader } from "./loader.js";
import {
  formatScope,
  printBanner,
  printError,
  renderCreated,
  renderMemoryList,
  renderSearchResults,
} from "./output.js";
import { gradientText, theme } from "./theme.js";

const HELP = `
${theme.label("Commands")}
  ${theme.accent("add")} <text>          remember text (LLM extracts facts)
  ${theme.accent("fact")} <text>         remember text verbatim, no extraction
  ${theme.accent("search")} <query>      semantic search (top 10)
  ${theme.accent("list")}                list memories in the current scope
  ${theme.accent("delete")} <id>         delete a memory by id
  ${theme.accent("delete all")}          delete every memory in the current scope
  ${theme.accent("scope")}               show the current scope
  ${theme.accent("scope")} user <id>     set the user scope (also: agent, session)
  ${theme.accent("scope clear")}         reset the scope
  ${theme.accent("clear")}               clear the screen
  ${theme.accent("help")}                show this help
  ${theme.accent("exit")}                quit
`;

function prompt(scope: MemoryScope): string {
  const scopeLabel =
    scope.userId || scope.agentId || scope.sessionId ? theme.dim(`(${formatScope(scope)})`) : "";
  return `${gradientText("turbomem")} ${scopeLabel}${theme.accent(" › ")}`;
}

export async function startRepl(overrides: ConfigOverrides = {}): Promise<void> {
  printBanner();

  const loader = new Loader();
  loader.start("connecting");
  let memory;
  try {
    ({ memory } = await buildMemory(overrides));
    loader.stop();
  } catch (err) {
    loader.stop();
    printError(err);
    process.exitCode = 1;
    return;
  }

  console.log(theme.dim("Type `help` for commands, `exit` to quit.\n"));

  const scope: MemoryScope = {};
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  let running = true;
  while (running) {
    const line = (await ask(prompt(scope))).trim();
    if (!line) continue;

    const [command, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ");

    try {
      switch (command.toLowerCase()) {
        case "help":
        case "?":
          console.log(HELP);
          break;

        case "exit":
        case "quit":
        case "q":
          running = false;
          break;

        case "clear":
        case "cls":
          console.clear();
          break;

        case "scope":
          handleScope(scope, rest);
          break;

        case "add":
        case "fact": {
          if (!arg) {
            console.log(theme.warn("Usage: add <text>"));
            break;
          }
          loader.start(command === "fact" ? "storing" : "extracting");
          const created =
            command === "fact"
              ? await memory.addFacts([arg], scope)
              : await memory.add([{ role: "user", content: arg }], scope);
          loader.stop();
          console.log(renderCreated(created));
          break;
        }

        case "search":
        case "s": {
          if (!arg) {
            console.log(theme.warn("Usage: search <query>"));
            break;
          }
          loader.start("searching");
          const results = await memory.search(arg, { ...scope, limit: 10 });
          loader.stop();
          console.log(renderSearchResults(results));
          break;
        }

        case "list":
        case "ls": {
          loader.start("loading");
          const memories = await memory.getAll(scope);
          loader.stop();
          console.log(renderMemoryList(memories));
          break;
        }

        case "delete":
        case "rm": {
          if (!arg) {
            console.log(theme.warn("Usage: delete <id> | delete all"));
            break;
          }
          loader.start("deleting");
          if (arg.toLowerCase() === "all") {
            await memory.deleteAll(scope);
            loader.succeed("Deleted all matching memories.");
          } else {
            await memory.delete(arg);
            loader.succeed(`Deleted memory ${arg}.`);
          }
          break;
        }

        default:
          console.log(theme.warn(`Unknown command: ${command}. Type \`help\`.`));
      }
    } catch (err) {
      loader.stop();
      printError(err);
    }
  }

  rl.close();
  await memory.close();
  console.log(theme.dim("\nGoodbye."));
}

function handleScope(scope: MemoryScope, rest: string[]): void {
  if (rest.length === 0) {
    console.log(theme.dim(`scope: ${formatScope(scope)}`));
    return;
  }
  const [key, value] = rest;
  if (key.toLowerCase() === "clear") {
    delete scope.userId;
    delete scope.agentId;
    delete scope.sessionId;
    console.log(theme.dim("scope cleared"));
    return;
  }
  if (!value) {
    console.log(theme.warn("Usage: scope <user|agent|session> <id> | scope clear"));
    return;
  }
  switch (key.toLowerCase()) {
    case "user":
      scope.userId = value;
      break;
    case "agent":
      scope.agentId = value;
      break;
    case "session":
      scope.sessionId = value;
      break;
    default:
      console.log(theme.warn("Scope key must be user, agent, or session."));
      return;
  }
  console.log(theme.dim(`scope: ${formatScope(scope)}`));
}
