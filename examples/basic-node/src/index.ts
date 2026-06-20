import { TurboMemory } from "turbomem";

/**
 * Minimal end-to-end example: add a conversation, then search the memory.
 * Requires OPENAI_API_KEY in the environment.
 */
async function main() {
  const memory = new TurboMemory({
    embeddings: "openai",
    storage: "pglite",
    extraction: { provider: "openai", model: "gpt-4o-mini" },
    openai: { apiKey: process.env.OPENAI_API_KEY },
    pglite: { dataDir: ".turbomem" },
  });

  await memory.init();

  await memory.add(
    [
      { role: "user", content: "Hey, I love hiking and I'm training for a half marathon this fall." },
      { role: "assistant", content: "Nice — I'll remember your fitness goals." },
    ],
    { userId: "user_123" },
  );

  const results = await memory.search("What outdoor activities is the user into?", {
    userId: "user_123",
    limit: 5,
  });

  console.log("Top memories:");
  for (const { memory: m, score } of results) {
    console.log(`  [${score.toFixed(3)}] ${m.content}`);
  }

  await memory.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
