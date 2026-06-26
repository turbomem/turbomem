import { TurboMemory } from "turbomem";
import { createMastraMemory } from "@turbomem/mastra";

/**
 * Demonstrates wrapping TurboMemory as a Mastra memory provider. Plug the
 * returned provider into your Mastra agent's memory configuration.
 */
async function main() {
  const memory = new TurboMemory({
    embeddings: "openai",
    storage: "pglite",
    extraction: { provider: "openai", model: "gpt-4.1-mini" },
    openai: { apiKey: process.env.OPENAI_API_KEY },
  });
  await memory.init();

  const provider = createMastraMemory(memory, { recallLimit: 5 });

  const context = { userId: "user_123", agentId: "support_agent" };

  await provider.remember(
    [{ role: "user", content: "I prefer email over phone calls for support." }],
    context,
  );

  const recalled = await provider.recall("How does the user want to be contacted?", context);
  console.log("Recalled context:\n", recalled);

  await memory.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
