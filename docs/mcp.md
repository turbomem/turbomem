---
title: MCP
description: Give Claude Desktop a private, local long-term memory with the turbomem MCP server, installable in one click as a .mcpb extension.
---

# MCP

Package: `@turbomem/mcp`

A [Model Context Protocol](https://modelcontextprotocol.io) server built on turbomem.
It gives Claude a private, **local** long-term memory: Claude can remember durable
facts about the user and recall them in future conversations. Everything is stored
on disk on the user's machine (the same `~/.turbomem/data` store as the
[CLI](/cli)); nothing is uploaded anywhere except the AI provider chosen to extract
and embed the notes.

It ships as a one-click **Claude Desktop extension** (`.mcpb`), so non-technical
users never touch a terminal or config file.

## Install in Claude Desktop (no terminal)

1. **Download** `turbomem.mcpb` (from the project [Releases](https://github.com/turbomem/turbomem/releases)).
2. **Double-click** the file - Claude Desktop opens an install screen. (You can also
   drag it onto the window, or use **Settings → Extensions → Advanced settings →
   Install Extension…**)
3. Fill in two fields and click **Install**:
   - **AI provider** - type `openai`, `google`, or `anthropic` (leave as `openai` if unsure).
   - **API key** - paste the key for that provider.

Then just chat. Claude saves and recalls memories on its own. Try
"Remember that my dog is named Rex," then, in a **new** chat, ask
"What's my dog's name?"

## Which API key do I need?

You only need **one** key, matching the provider you chose:

| Provider    | Get a key                                                            | What it powers                      |
| ----------- | -------------------------------------------------------------------- | ----------------------------------- |
| `openai`    | [platform.openai.com](https://platform.openai.com/api-keys)          | Understanding + searching memories  |
| `google`    | [aistudio.google.com](https://aistudio.google.com/app/apikey)        | Understanding + searching memories  |
| `anthropic` | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Understanding memories (extraction) |

`openai` and `google` use a single key for both understanding and search. See the
[Providers reference](/guide/providers) for details.

::: tip Using Anthropic (Claude)?
Anthropic can organize your memories, but it has no embedding model, so **memory
search needs a second provider**. On the install screen, set:

- **AI provider** → `anthropic`, **API key** → your Anthropic key
- **Search provider** → `openai` or `google`, **Search API key** → that provider's key

That runs extraction on Claude and search on OpenAI/Google over HTTP — no local
model or extra download required. (Advanced: you can instead run search fully
on-device by installing `@huggingface/transformers` via the [manual setup](#advanced-manual-setup).)
:::

## Tools

Claude is instructed to use these automatically, but you can also ask for them
directly ("list everything you remember about me", "forget that I like dark mode").

| Tool                | Description                                         |
| ------------------- | --------------------------------------------------- |
| `remember`          | Saves durable facts about the user to local memory  |
| `recall`            | Searches memory for anything relevant to a query    |
| `list_memories`     | Lists everything currently stored                   |
| `forget`            | Deletes one memory by id                            |
| `forget_everything` | Erases all memories (only on explicit confirmation) |

## Advanced: manual setup

For another MCP client, or to wire it up by hand, run the server over stdio.

```bash
npm install -g @turbomem/mcp
```

Add it to `claude_desktop_config.json`:

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

To run extraction on Anthropic and search on OpenAI (no local model):

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

To run Anthropic search fully on-device instead (no embeddings key), set
`TURBOMEM_EMBEDDINGS_PROVIDER=local` and install the local model:

```bash
npm install -g @huggingface/transformers
```

### Environment variables

| Variable                       | Default            | Notes                                                         |
| ------------------------------ | ------------------ | ------------------------------------------------------------- |
| `TURBOMEM_PROVIDER`            | `openai`           | Extraction provider: `openai`, `google`, or `anthropic`       |
| `TURBOMEM_API_KEY`             | -                  | API key for the extraction provider (required)                |
| `TURBOMEM_EMBEDDINGS_PROVIDER` | mirrors provider   | Search provider: `openai`, `google`, or `local`               |
| `TURBOMEM_EMBEDDINGS_API_KEY`  | -                  | API key for the search provider (needed unless it is `local`) |
| `TURBOMEM_USER_ID`             | `me`               | Label for this memory profile                                 |
| `TURBOMEM_DATA_DIR`            | `~/.turbomem/data` | Where memories are stored on disk                             |
| `TURBOMEM_EXTRACTION_MODEL`    | provider default   | Override the fact-extraction model                            |
| `TURBOMEM_EMBEDDING_MODEL`     | provider default   | Override the embedding model                                  |

Standard provider env vars (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`)
are also honored as fallbacks for the matching provider.

## Privacy Policy

turbomem is local-first. Memories stay on your machine; we do not receive your data or API keys. See the [Privacy Policy](/privacy) (also at [turbomem.dev/privacy](https://turbomem.dev/privacy)).
