import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { TurboMemory, Memory, MemorySearchResult } from "turbomem";
import { buildMemory, resolveConfig, type ResolvedConfig } from "./config.js";
import { VERSION } from "./version.js";

const INSTRUCTIONS = `turbomem gives you a persistent, private long-term memory that lives on the user's computer and carries across conversations.

Use it proactively:
- Call "remember" whenever the user shares durable facts about themselves, their preferences, projects, relationships, or ongoing goals (e.g. "my dog is named Rex", "I use TypeScript", "I'm training for a marathon"). You don't need to ask permission for clearly durable facts.
- Call "recall" before answering questions that depend on personal context or past conversations, and at the start of a new chat when the user refers to things they told you before.
- Use "list_memories" to review everything that is stored, and "forget" to remove a specific memory the user no longer wants kept.

Memories are stored locally and are never uploaded anywhere except the AI provider used to extract and embed them.`;

/** Text response helper. */
function text(body: string, isError = false) {
  return { content: [{ type: "text" as const, text: body }], isError };
}

/** Lazily create and cache a single TurboMemory instance for the process. */
let memoryPromise: Promise<{ memory: TurboMemory; resolved: ResolvedConfig }> | null = null;
function getMemory(): Promise<{ memory: TurboMemory; resolved: ResolvedConfig }> {
  if (!memoryPromise) {
    memoryPromise = buildMemory().catch((err) => {
      // Reset so a later call can retry once the user fixes their config.
      memoryPromise = null;
      throw err;
    });
  }
  return memoryPromise;
}

function scope() {
  return { userId: resolveConfig().userId };
}

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `Sorry, that memory operation failed: ${message}`;
}

function renderMemory(m: Memory): string {
  return `- (${m.id}) ${m.content}`;
}

function renderSearchResult({ memory, score }: MemorySearchResult): string {
  return `- [${score.toFixed(3)}] (${memory.id}) ${memory.content}`;
}

const server = new McpServer(
  { name: "turbomem", version: VERSION },
  { instructions: INSTRUCTIONS },
);

server.registerTool(
  "remember",
  {
    title: "Remember",
    description:
      "Save durable information about the user to long-term memory. Pass a natural-language statement; discrete facts are extracted and stored locally. Use for preferences, personal details, projects, and goals worth recalling later.",
    inputSchema: {
      content: z
        .string()
        .min(1)
        .describe("What to remember, in plain language (e.g. 'My dog is named Rex')."),
    },
  },
  async ({ content }) => {
    try {
      const { memory } = await getMemory();
      const stored = await memory.add([{ role: "user", content }], scope());
      if (stored.length === 0) {
        return text("Nothing new to remember — that information is already stored.");
      }
      const lines = stored.map((m) => renderMemory(m)).join("\n");
      return text(`Remembered ${stored.length} fact(s):\n${lines}`);
    } catch (err) {
      return text(friendlyError(err), true);
    }
  },
);

server.registerTool(
  "recall",
  {
    title: "Recall",
    description:
      "Search the user's long-term memory for information relevant to a query. Use before answering questions that rely on personal context or things the user said in earlier conversations.",
    inputSchema: {
      query: z.string().min(1).describe("What to look for (a question or topic)."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Maximum number of memories to return (default 5)."),
    },
  },
  async ({ query, limit }) => {
    try {
      const { memory } = await getMemory();
      const results = await memory.search(query, { ...scope(), limit: limit ?? 5 });
      if (results.length === 0) {
        return text("No relevant memories found.");
      }
      const lines = results.map((r) => renderSearchResult(r)).join("\n");
      return text(`Found ${results.length} relevant memory(ies):\n${lines}`);
    } catch (err) {
      return text(friendlyError(err), true);
    }
  },
);

server.registerTool(
  "list_memories",
  {
    title: "List memories",
    description:
      "List every memory stored for the user, newest first. Useful for reviewing or before deciding what to forget.",
    inputSchema: {},
  },
  async () => {
    try {
      const { memory } = await getMemory();
      const all = await memory.getAll(scope());
      if (all.length === 0) {
        return text("No memories stored yet.");
      }
      const lines = all.map((m) => renderMemory(m)).join("\n");
      return text(`${all.length} memory(ies) stored:\n${lines}`);
    } catch (err) {
      return text(friendlyError(err), true);
    }
  },
);

server.registerTool(
  "forget",
  {
    title: "Forget",
    description:
      "Delete a single memory by its id. Get ids from 'recall' or 'list_memories'. This cannot be undone.",
    inputSchema: {
      id: z.string().min(1).describe("The id of the memory to delete."),
    },
  },
  async ({ id }) => {
    try {
      const { memory } = await getMemory();
      await memory.delete(id);
      return text(`Forgotten memory ${id}.`);
    } catch (err) {
      return text(friendlyError(err), true);
    }
  },
);

server.registerTool(
  "forget_everything",
  {
    title: "Forget everything",
    description:
      "Permanently delete ALL of the user's stored memories. Destructive and irreversible — only use when the user explicitly asks to wipe their memory. Requires confirm=true.",
    inputSchema: {
      confirm: z
        .boolean()
        .describe("Must be true to proceed. Confirm the user really wants to erase all memories."),
    },
  },
  async ({ confirm }) => {
    if (!confirm) {
      return text("Not cleared. Set confirm=true only after the user explicitly confirms.");
    }
    try {
      const { memory } = await getMemory();
      await memory.deleteAll(scope());
      return text("All memories have been erased.");
    } catch (err) {
      return text(friendlyError(err), true);
    }
  },
);

async function shutdown(): Promise<void> {
  if (memoryPromise) {
    try {
      const { memory } = await memoryPromise;
      await memory.close();
    } catch {
      // Best effort — we're exiting anyway.
    }
  }
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void shutdown().finally(() => process.exit(0));
    });
  }
  // Never write to stdout — it carries the JSON-RPC stream. Logs go to stderr.
  console.error(`[turbomem] MCP server ${VERSION} ready (stdio).`);
}

main().catch((err) => {
  console.error("[turbomem] Fatal error starting MCP server:", err);
  process.exit(1);
});
