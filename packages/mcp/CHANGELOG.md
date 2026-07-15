# @turbomem/mcp

## 0.2.1

### Patch Changes

- 45c3e1c: Add tool annotations (`readOnlyHint` / `destructiveHint`) for Connectors Directory submission, and resolve embeddings and extraction providers independently. You can now run extraction on Anthropic while using OpenAI or Google for search over HTTP (`TURBOMEM_EMBEDDINGS_PROVIDER` / `TURBOMEM_EMBEDDINGS_API_KEY`, or the new "Search provider" fields in the installer), so Anthropic works without the large local embedding model. The one-click `.mcpb` bundle drops `@huggingface/transformers`, keeping it small (~14 MB); on-device search remains available via a manual `@huggingface/transformers` install with `TURBOMEM_EMBEDDINGS_PROVIDER=local`.

## 0.2.0

### Minor Changes

- 53209a6: Add `@turbomem/mcp`: a Model Context Protocol server that gives Claude Desktop a private, local long-term memory. Ships as a one-click `.mcpb` extension with `remember`, `recall`, `list_memories`, `forget`, and `forget_everything` tools, and supports OpenAI, Google, and Anthropic providers via a single API key.
