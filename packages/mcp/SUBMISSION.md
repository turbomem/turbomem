# Connectors Directory submission

Submit **@turbomem/mcp** as a desktop extension (MCPB).

**Form:** [Desktop extensions submission form](https://docs.google.com/forms/d/14_Dmcig4z8NeRMB_e7TOyrKzuZ88-BLYdLvS6LPhiZU/viewform)

**Artifact:** `turbomem.mcpb` (v0.2.3, ~14 MB) — build with `pnpm --filter @turbomem/mcp pack:mcpb`, or download from the GitHub release after publish.

**Icon:** `packages/mcp/icon.png` (512×512 PNG)

---

## Listing copy

| Field | Value |
| ----- | ----- |
| **Name** | turbomem — personal memory |
| **Tagline** (≤55 chars) | Private local memory for Claude across chats |
| **Short description** | Give Claude a private, local long-term memory that remembers things about you across conversations. |
| **Long description** | See `long_description` in [manifest.json](./manifest.json) |
| **Documentation** | https://docs.turbomem.dev/mcp |
| **Privacy policy** | https://turbomem.dev/privacy |
| **Support** | https://github.com/turbomem/turbomem/issues |
| **Homepage** | https://turbomem.dev |
| **GitHub** | https://github.com/turbomem/turbomem |
| **License** | Apache-2.0 |

## Use cases

- Personal long-term memory that persists across Claude Desktop conversations
- Remember preferences, projects, relationships, and goals locally on the user's machine
- Semantic recall before answering questions that depend on past context

## Data handling

- **Reads/writes:** User-provided facts stored locally at `~/.turbomem/data` (configurable)
- **Third-party:** Extraction and embedding API calls to the user's chosen provider (OpenAI, Google, or Anthropic + optional search provider)
- **No turbomem cloud:** Open-source local extension; no data sent to turbomem servers
- **Not health data / not sponsored content**

## Test credentials for reviewers

Provide a **dedicated low-limit OpenAI API key** (recommended primary path).

### Install steps for reviewers

1. Download `turbomem.mcpb` from [GitHub Releases](https://github.com/turbomem/turbomem/releases) (tag `@turbomem/mcp@0.2.3`) or use the file built locally.
2. Double-click the `.mcpb` (or **Settings → Extensions → Advanced settings → Install Extension…**).
3. Set **AI provider** → `openai`
4. Set **API key** → _(paste test key)_
5. Leave other fields at defaults. Click **Install**.

### Tool exercises (run each in Claude Desktop)

| Tool | Prompt / action | Expected |
| ---- | ----------------- | -------- |
| `remember` | "Remember that my dog is named Rex." | Confirms facts stored |
| `recall` | New chat: "What's my dog's name?" | Returns Rex |
| `list_memories` | "List everything you remember about me." | Shows stored memories with ids |
| `forget` | "Forget the memory about my dog." (or by id) | One memory removed |
| `forget_everything` | "Delete all my memories" (must confirm) | All memories erased |

### Optional second path (Anthropic + search)

- **AI provider** → `anthropic` + Anthropic test key
- **Search provider** → `openai` + OpenAI test key

## Compliance acknowledgments

- Meets Anthropic Software Directory Policy and Terms
- MCPB is open source (public GitHub repo)
- Accept MCPB "spec will evolve" clause (non-waivable)
- Every tool has `title` and `readOnlyHint` / `destructiveHint` annotations
- Privacy policy published at https://turbomem.dev/privacy

## Pre-submit checklist

```bash
pnpm --filter @turbomem/mcp test
pnpm --filter @turbomem/mcp pack:mcpb
node packages/mcp/scripts/verify-mcpb.mjs
```

Then complete manual QA in Claude Desktop ([QA.md](./QA.md)).

## After publish

1. Push to `master` so the release workflow publishes `@turbomem/mcp@0.2.3` and uploads `turbomem.mcpb` to GitHub Releases.
2. Submit the release artifact via the form above.
3. Escalations: mcp-review@anthropic.com
