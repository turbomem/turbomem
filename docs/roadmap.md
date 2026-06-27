---
title: Roadmap
description: Planned features and future direction for turbomem.
---

# Roadmap

This page tracks what we're planning next. For what's already available today,
see the [Guide](/guide/getting-started).

## Planned

- **CLI storage backend selection** - optional sqlite-vec or Upstash Vector support in `@turbomem/cli` for managing remote indexes from the terminal.

## Recently shipped

- **Memory deduplication / update-in-place** - merge or update existing memories when new facts overlap. Supports `merge` (multi-way LLM consolidation), smart `replace`, and `skip` strategies. Enabled by default. See [Configuration](/guide/configuration#deduplication).
- **Edge runtime support** - opt-in [Upstash Vector](/guide/edge) storage for Cloudflare Workers, Vercel Edge, and other stateless runtimes.
- **sqlite-vec storage** - optional local SQLite backend alongside the default PGlite adapter. See [Storage](/guide/storage).

## Feedback

Have a feature request or want to influence the roadmap? Open a
[GitHub issue](https://github.com/turbomem/turbomem/issues) or
[contact us](/contact).
