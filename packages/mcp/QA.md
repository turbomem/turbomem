# Manual QA checklist (Claude Desktop)

Run after `pnpm --filter @turbomem/mcp pack:mcpb`. Automated checks: `node scripts/verify-mcpb.mjs`.

## OpenAI path (primary)

- [ ] Install `turbomem.mcpb` via double-click or Settings → Extensions
- [ ] Provider `openai`, valid API key, default data dir
- [ ] **remember:** "Remember that my dog is named Rex." → success message with fact(s)
- [ ] **recall:** New chat → "What's my dog's name?" → Rex
- [ ] **list_memories:** Lists stored items with ids
- [ ] **forget:** Remove one memory by id or natural language
- [ ] **forget_everything:** Only runs with explicit user confirmation

## Anthropic + OpenAI search path (optional)

- [ ] Provider `anthropic` + Anthropic API key
- [ ] Search provider `openai` + OpenAI API key
- [ ] **remember** and **recall** work without local embedding model

## Platforms

- [ ] macOS (`darwin`) — primary dev platform
- [ ] Windows (`win32`) — if available

## Uninstall / data

- [ ] Uninstalling extension leaves `~/.turbomem/data` on disk (documented behavior)
- [ ] Deleting data dir removes all memories

Record results in the submission form or internal notes before filing.
