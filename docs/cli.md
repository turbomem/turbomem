---
title: CLI
description: Add, search, and manage turbomem memories from your terminal with one-shot commands or an interactive shell.
---

# CLI

Package: `@turbomem/cli`

A command-line interface for turbomem. Add, search, and manage memories directly
from your terminal, with one-shot commands and an interactive shell.

## Install

```bash
npm install -g @turbomem/cli
# or run without installing
npx @turbomem/cli init
```

## Setup

```bash
turbomem init
```

This interactive wizard writes `~/.turbomem/config.json` (embeddings + extraction
providers, API keys, data directory). Environment variables (`OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `TURBOMEM_DATA_DIR`) and command flags override the saved
config.

## Commands

```bash
# Remember something (LLM extracts discrete facts)
turbomem add "I love hiking and I'm training for a half marathon" --user user_123

# Store a verbatim fact, skipping extraction
turbomem add "Prefers dark mode" --fact --user user_123

# Semantic search
turbomem search "what outdoor activities is the user into?" --user user_123 --limit 5

# List everything in a scope
turbomem list --user user_123

# Delete one memory, or clear a whole scope
turbomem delete <id>
turbomem delete --all --user user_123

# Inspect resolved configuration
turbomem config
```

All memory commands accept scope flags: `-u, --user`, `-a, --agent`, `-s, --session`.

## Interactive shell

Run `turbomem` with no arguments (or `turbomem shell`) to open the REPL:

```
turbomem ›
```

or

```
npx @turbomem/cli
```

Inside the shell:

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `add <text>`      | Remember text (LLM extraction)      |
| `fact <text>`     | Remember text verbatim              |
| `search <query>`  | Semantic search                     |
| `list`            | List memories in the current scope  |
| `delete <id>`     | Delete a memory                     |
| `delete all`      | Delete every memory in the scope    |
| `scope user <id>` | Set scope (also `agent`, `session`) |
| `scope clear`     | Reset the scope                     |
| `help`            | Show help                           |
| `exit`            | Quit                                |
