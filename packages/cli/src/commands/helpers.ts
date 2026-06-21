import type { Command } from "commander";
import type { MemoryScope } from "turbomem";
import type { ConfigOverrides } from "../config.js";

/** Options shared by scope-aware commands. */
export interface ScopeOptions {
  user?: string;
  agent?: string;
  session?: string;
}

/** Attach the standard `-u/-a/-s` scope flags to a command. */
export function addScopeOptions(cmd: Command): Command {
  return cmd
    .option("-u, --user <id>", "scope to a user id")
    .option("-a, --agent <id>", "scope to an agent id")
    .option("-s, --session <id>", "scope to a session id");
}

/** Build a {@link MemoryScope} from parsed scope options. */
export function getScope(opts: ScopeOptions): MemoryScope {
  const scope: MemoryScope = {};
  if (opts.user) scope.userId = opts.user;
  if (opts.agent) scope.agentId = opts.agent;
  if (opts.session) scope.sessionId = opts.session;
  return scope;
}

/** Pull global config overrides (e.g. `--data-dir`) off the root program. */
export function getOverrides(cmd: Command): ConfigOverrides {
  const root = cmd.parent ?? cmd;
  const globals = root.opts<{ dataDir?: string }>();
  return { dataDir: globals.dataDir };
}
