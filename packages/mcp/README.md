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

| Provider    | Where to get a key                          | What it powers                      |
| ----------- | ------------------------------------------- | ----------------------------------- |
| `openai`    | https://platform.openai.com/api-keys        | Understanding + searching memories  |
| `google`    | https://aistudio.google.com/app/apikey      | Understanding + searching memories  |
| `anthropic` | https://console.anthropic.com/settings/keys | Understanding memories (extraction) |

`openai` and `google` use a single key for both understanding and search.

**Using Anthropic (Claude)?** Anthropic has no embedding model, so search needs a second provider. On the install screen set **AI provider** = `anthropic` (+ your Anthropic key), then **Search provider** = `openai` or `google` (+ that provider's key). Extraction runs on Claude and search runs on OpenAI/Google over HTTP — no local model needed.

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
        "TURBOMEM_API_KEY": "sk-...",
        "TURBOMEM_USER_ID": "me",
        "TURBOMEM_DATA_DIR": "/Users/you/.turbomem/data"
      }
    }
  }
}
```

Anthropic extraction with OpenAI search (no local model):

```json
{
  "mcpServers": {
    "turbomem": {
      "command": "turbomem-mcp",
      "env": {
        "TURBOMEM_PROVIDER": "anthropic",
        "TURBOMEM_API_KEY": "sk-ant-...",
        "TURBOMEM_EMBEDDINGS_PROVIDER": "openai",
        "TURBOMEM_EMBEDDINGS_API_KEY": "sk-..."
      }
    }
  }
}
```

Or run without installing:

```bash
npx @turbomem/mcp
```

Prefer Anthropic search fully on-device? Set `TURBOMEM_EMBEDDINGS_PROVIDER=local` and install the local model:

```bash
npm install -g @huggingface/transformers
```

### Environment variables

| Variable                       | Default            | Notes                                                   |
| ------------------------------ | ------------------ | ------------------------------------------------------- |
| `TURBOMEM_PROVIDER`            | `openai`           | Extraction provider: `openai`, `google`, or `anthropic` |
| `TURBOMEM_API_KEY`             | -                  | API key for the extraction provider (required)          |
| `TURBOMEM_EMBEDDINGS_PROVIDER` | mirrors provider   | Search provider: `openai`, `google`, or `local`         |
| `TURBOMEM_EMBEDDINGS_API_KEY`  | -                  | API key for the search provider (needed unless `local`) |
| `TURBOMEM_USER_ID`             | `me`               | Label for this memory profile                           |
| `TURBOMEM_DATA_DIR`            | `~/.turbomem/data` | Where memories are stored on disk                       |
| `TURBOMEM_EXTRACTION_MODEL`    | provider default   | Override the fact-extraction model                      |
| `TURBOMEM_EMBEDDING_MODEL`     | provider default   | Override the embedding model                            |

> Standard provider env vars (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`) are also honored as fallbacks. With `openai`/`google`, one key covers both extraction and search; `anthropic` needs a separate search provider (or `local`).

## License

Apache License 2.0
