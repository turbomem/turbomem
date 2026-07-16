---
title: Privacy Policy
description: How turbomem handles your data - local storage, third-party AI providers, and your rights.
---

# Privacy Policy

**Last updated:** July 16, 2026

This policy describes how turbomem ("we", "us") handles information when you use the open-source turbomem library, the turbomem CLI, and the **@turbomem/mcp** Claude Desktop extension.

## Summary

turbomem is **local-first**. Your memories are stored on your own computer. We do not operate a cloud memory service and we do not receive your memories, chat content, or API keys.

The only external network traffic is to the **AI provider you choose** (OpenAI, Google, or Anthropic) to extract facts from text and generate embeddings for search.

## What we collect

### Data you provide

When you use turbomem, you may provide:

- **Memory content** - facts and preferences you ask Claude or the CLI to remember (e.g. "my dog is named Rex").
- **API keys** - keys for your chosen AI provider(s), entered in the Claude Desktop extension installer or environment variables.
- **Configuration** - optional settings such as storage path, memory profile name, and provider choice.

### Data we do not collect

turbomem does **not**:

- Send memories or API keys to turbomem servers (we do not operate backend servers for the open-source product).
- Collect analytics from the MCP extension or CLI by default.
- Access your Claude conversations beyond what you explicitly pass to memory tools.

## How your data is stored and used

### Local storage

Memories are persisted in a database on your machine. The default location is `~/.turbomem/data`. You can change this path in the extension installer or via `TURBOMEM_DATA_DIR`.

Only you (and software running on your device with filesystem access) can read this data.

### Third-party AI providers

To organize and search memories, turbomem sends relevant text to the provider(s) you configure:

| Provider        | Typical use                                                                |
| --------------- | -------------------------------------------------------------------------- |
| OpenAI          | Fact extraction and semantic search (single key)                           |
| Google (Gemini) | Fact extraction and semantic search (single key)                           |
| Anthropic       | Fact extraction; search may use OpenAI, Google, or a local on-device model |

That traffic is governed by the provider's terms and privacy policy:

- [OpenAI Privacy Policy](https://openai.com/policies/privacy-policy)
- [Google Privacy Policy](https://policies.google.com/privacy)
- [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)

We do not control how those providers process API requests. Review their policies before entering API keys.

### API keys

API keys are stored by Claude Desktop as part of your extension configuration (or in environment variables for manual setups). They are used only to authenticate requests to your chosen provider(s). turbomem does not transmit keys to us.

## Data retention and deletion

You control retention:

- **`forget`** - delete a single memory by id.
- **`forget_everything`** - erase all memories (requires explicit confirmation).
- **Delete the data directory** - remove `~/.turbomem/data` (or your custom path) from disk.

Uninstalling the extension does not automatically delete stored memories; remove the data directory if you want a full wipe.

## Website and waitlist

**turbomem.dev** and **docs.turbomem.dev** are static documentation sites. If you join the turbomem Cloud waitlist or contact us by email, we handle that information according to the form or email provider's practices. Waitlist data is separate from MCP memory storage.

## Children's privacy

turbomem is a developer tool not directed at children under 13. We do not knowingly collect personal information from children.

## Changes to this policy

We may update this policy as the product evolves. The "Last updated" date at the top will change when we do. Continued use after changes constitutes acceptance of the revised policy.

## Contact

Questions about privacy:

- Email: [arneesh@turbomem.dev](mailto:arneesh@turbomem.dev)
- GitHub: [github.com/turbomem/turbomem/issues](https://github.com/turbomem/turbomem/issues)

Canonical URL: [https://turbomem.dev/privacy](https://turbomem.dev/privacy)
