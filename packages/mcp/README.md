# @turbomem/mcp

[![npm version](https://img.shields.io/npm/v/@turbomem/mcp)](https://www.npmjs.com/package/@turbomem/mcp) · [Documentation](https://docs.turbomem.dev)

Give Claude a private, **local** long-term memory. This is a [Model Context Protocol](https://modelcontextprotocol.io) server built on [turbomem](https://www.npmjs.com/package/turbomem). Claude can remember durable facts about you and recall them in future conversations. Everything is stored on your own computer - nothing is uploaded anywhere except the AI provider you choose to read and organize your notes.

Ships as a one-click **Claude Desktop extension** (`.mcpb`), so no terminal or config files are required.

## Install in Claude Desktop (no terminal needed)

1. **Download** `turbomem.mcpb` (from the [Releases page](https://github.com/turbomem/turbomem/releases)).
2. **Double-click** the file, Claude Desktop opens an install screen. (You can also drag it onto Claude Desktop, or go to **Settings → Extensions → Advanced settings → Install Extension…**)
3. On the install screen, fill in two things and click **Install**:
   - **AI provider** - type `openai`, `google`, or `anthropic` (leave as `openai` if unsure).
   - **API key** - paste the key for that provider.

That's it. Start a chat and talk normally. Claude will save and recall memories on its own. Try:

> "Remember that my dog is named Rex."

then, in a **new** chat:

> "What's my dog's name?"

### Which API key do I need?

You only need **one** key, matching the provider you typed:

| Provider    | Where to get a key                          | What it powers                                         |
| ----------- | ------------------------------------------- | ------------------------------------------------------ |
| `openai`    | https://platform.openai.com/api-keys        | Understanding + searching memories                     |
| `google`    | https://aistudio.google.com/app/apikey      | Understanding + searching memories                     |
| `anthropic` | https://console.anthropic.com/settings/keys | Understanding memories (search runs locally on-device) |

Your memories live on disk at `~/.turbomem/data` by default, the same store used by the [turbomem CLI](https://www.npmjs.com/package/@turbomem/cli).

## What Claude can do

| Tool                | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `remember`          | Saves durable facts about you to local memory         |
| `recall`            | Searches your memory for anything relevant to a query |
| `list_memories`     | Lists everything currently stored                     |
| `forget`            | Deletes one memory by id                              |
| `forget_everything` | Erases all memories (only on explicit confirmation)   |

Claude is instructed to use these automatically, but you can always ask it directly, e.g. "list everything you remember about me" or "forget that I like dark mode."

## Advanced: manual setup

Prefer to wire it up yourself, or using another MCP client? Run the server over stdio.

```bash
npm install -g @turbomem/mcp
```

Add it to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "turbomem": {
      "command": "turbomem-mcp",
      "env": {
        "TURBOMEM_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-...",
        "TURBOMEM_USER_ID": "me",
        "TURBOMEM_DATA_DIR": "/Users/you/.turbomem/data"
      }
    }
  }
}
```

Or run without installing:

```bash
npx @turbomem/mcp
```

### Environment variables

| Variable                    | Default            | Notes                                 |
| --------------------------- | ------------------ | ------------------------------------- |
| `TURBOMEM_PROVIDER`         | `openai`           | `openai`, `google`, or `anthropic`    |
| `OPENAI_API_KEY`            | -                  | Required when provider is `openai`    |
| `GEMINI_API_KEY`            | -                  | Required when provider is `google`    |
| `ANTHROPIC_API_KEY`         | -                  | Required when provider is `anthropic` |
| `TURBOMEM_USER_ID`          | `me`               | Label for this memory profile         |
| `TURBOMEM_DATA_DIR`         | `~/.turbomem/data` | Where memories are stored on disk     |
| `TURBOMEM_EXTRACTION_MODEL` | provider default   | Override the fact-extraction model    |
| `TURBOMEM_EMBEDDING_MODEL`  | provider default   | Override the embedding model          |

> `anthropic` has no embedding model, so search runs on a local WASM embedding model (downloaded once on first use). `openai` and `google` use a single key for both understanding and search.

## Build the .mcpb yourself

```bash
pnpm --filter @turbomem/mcp pack:mcpb
```

This builds the server, installs its production dependencies into a bundle, and writes `turbomem.mcpb` in the package directory.

## License

Apache License 2.0
