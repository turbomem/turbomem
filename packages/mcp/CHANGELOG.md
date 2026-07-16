# @turbomem/mcp

## 0.2.3

### Patch Changes

- Add turbomem privacy policy (turbomem.dev/privacy, docs.turbomem.dev/privacy) and README Privacy Policy section
- Add 512×512 bundle icon for Connectors Directory listing
- Point manifest documentation to docs.turbomem.dev/mcp; update long_description for all providers
- Add Connectors Directory submission guide (SUBMISSION.md)

## 0.2.2

### Patch Changes

- Add tool annotations (`readOnlyHint` / `destructiveHint`) for Connectors Directory submission
- Resolve embeddings and extraction providers independently (Anthropic + OpenAI/Google search over HTTP)
- Drop `@huggingface/transformers` from one-click `.mcpb` bundle (~14 MB)

## 0.2.0

### Minor Changes

- Initial `@turbomem/mcp` release: Claude Desktop `.mcpb` extension with `remember`, `recall`, `list_memories`, `forget`, and `forget_everything`
