---
"@turbomem/mcp": patch
---

Add tool annotations (`readOnlyHint` / `destructiveHint`) for Connectors Directory submission, and resolve embeddings and extraction providers independently. You can now run extraction on Anthropic while using OpenAI or Google for search over HTTP (`TURBOMEM_EMBEDDINGS_PROVIDER` / `TURBOMEM_EMBEDDINGS_API_KEY`, or the new "Search provider" fields in the installer), so Anthropic works without the large local embedding model. The one-click `.mcpb` bundle drops `@huggingface/transformers`, keeping it small (~14 MB); on-device search remains available via a manual `@huggingface/transformers` install with `TURBOMEM_EMBEDDINGS_PROVIDER=local`.
