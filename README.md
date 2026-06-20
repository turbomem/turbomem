# turbomem

**Local-first agent memory for TypeScript. No Python. No servers. Just `npm install`.**

turbomem gives your LLM agents persistent, semantically-searchable memory that runs
entirely inside your Node/Bun process.

```bash
npm install turbomem
```

```ts
import { TurboMemory } from "turbomem";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4o-mini" },
  openai: { apiKey: process.env.OPENAI_API_KEY },
});

await memory.init();
await memory.add(
  [{ role: "user", content: "I love hiking and I'm training for a half marathon this fall." }],
  { userId: "user_123" },
);
const results = await memory.search("What outdoor activities is the user into?", {
  userId: "user_123",
});
```

**Documentation:** [turbomem.github.io/turbomem](https://turbomem.github.io/turbomem/)

## License

MIT
