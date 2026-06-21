import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import readline from "node:readline";
import type { MemoryScope } from "turbomem";
import {
  buildMemory,
  hasConfigFile,
  resolveConfig,
  TURBOMEM_HOME,
  type ConfigOverrides,
} from "./config.js";
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
import { VERSION } from "./version.js";

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

${theme.dim("Tip: commands also work with a leading slash (e.g. /help), Tab completes,")}
${theme.dim("and ↑/↓ recall history.")}
`;

/** Commands offered by Tab-completion in the shell. */
const COMMANDS = [
  "add",
  "fact",
  "search",
  "list",
  "delete",
  "scope",
  "clear",
  "help",
  "exit",
];
const SCOPE_SUBCOMMANDS = ["user", "agent", "session", "clear"];

const HISTORY_PATH = join(TURBOMEM_HOME, "history");
const HISTORY_LIMIT = 200;

/** Load shell history (most-recent-first), tolerating a missing file. */
function loadHistory(): string[] {
  try {
    return readFileSync(HISTORY_PATH, "utf8").split("\n").filter(Boolean).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

/** Persist shell history (most-recent-first) to disk. */
function saveHistory(history: string[]): void {
  try {
    mkdirSync(TURBOMEM_HOME, { recursive: true });
    writeFileSync(HISTORY_PATH, history.slice(0, HISTORY_LIMIT).join("\n") + "\n", "utf8");
  } catch {
    // History is best-effort; ignore write failures.
  }
}

/** Tab-completion for top-level commands and `scope` sub-commands. */
function completer(line: string): [string[], string] {
  const parts = line.split(/\s+/);
  const lead = parts[0] ?? "";
  const slash = lead.startsWith("/") ? "/" : "";
  const bare = lead.slice(slash.length).toLowerCase();

  if (parts.length <= 1) {
    const hits = COMMANDS.filter((c) => c.startsWith(bare)).map((c) => slash + c);
    return [hits.length ? hits : COMMANDS.map((c) => slash + c), line];
  }

  if (bare === "scope" && parts.length === 2) {
    const frag = parts[1].toLowerCase();
    const hits = SCOPE_SUBCOMMANDS.filter((s) => s.startsWith(frag));
    return [hits.length ? hits : SCOPE_SUBCOMMANDS, parts[1]];
  }

  return [[], line];
}

/** Display the home directory as `~` for a tidier banner. */
function tildify(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function prompt(scope: MemoryScope): string {
  const active = scope.userId || scope.agentId || scope.sessionId;
  const chip = active
    ? `${theme.dim("[")}${theme.accent(formatScope(scope))}${theme.dim("]")} `
    : "";
  return `${chip}${gradientText("turbomem")}${theme.accent(" › ")}`;
}

export async function startRepl(overrides: ConfigOverrides = {}): Promise<void> {
  const resolved = resolveConfig(overrides);
  printBanner({
    version: VERSION,
    embeddings: resolved.embeddings,
    extraction: `${resolved.extractionProvider} (${resolved.extractionModel})`,
    dataDir: tildify(resolved.dataDir),
    needsInit: !hasConfigFile(),
  });

  const loader = new Loader();
  loader.start(["connecting", "warming up store"]);
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

  const scope: MemoryScope = {};
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
    history: loadHistory(),
    historySize: HISTORY_LIMIT,
    removeHistoryDuplicates: true,
  });
  const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  let running = true;
  while (running) {
    const line = (await ask(prompt(scope))).trim();
    if (!line) continue;

    const [rawCommand, ...rest] = line.split(/\s+/);
    const command = rawCommand.replace(/^\//, "").toLowerCase();
    const arg = rest.join(" ");

    try {
      switch (command) {
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
          printBanner({
            version: VERSION,
            embeddings: resolved.embeddings,
            extraction: `${resolved.extractionProvider} (${resolved.extractionModel})`,
            dataDir: tildify(resolved.dataDir),
            needsInit: !hasConfigFile(),
          });
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
          loader.start(
            command === "fact" ? "storing" : ["extracting facts", "embedding", "saving"],
          );
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
          loader.start(["searching", "scoring matches"]);
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
          console.log(theme.warn(`Unknown command: ${command}. Type \`/help\`.`));
      }
    } catch (err) {
      loader.stop();
      printError(err);
    }
  }

  saveHistory((rl as unknown as { history?: string[] }).history ?? []);
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
