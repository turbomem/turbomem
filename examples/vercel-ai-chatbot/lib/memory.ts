import { TurboMemory } from "turbomem";

let instance: TurboMemory | null = null;
let initPromise: Promise<TurboMemory> | null = null;

/**
 * Lazily create and initialise a single shared TurboMemory instance.
 * In serverless environments prefer a persistent dataDir on a writable volume.
 */
export async function getMemory(): Promise<TurboMemory> {
  if (instance) return instance;
  if (!initPromise) {
    initPromise = (async () => {
      const memory = new TurboMemory({
        embeddings: "openai",
        storage: "pglite",
        extraction: { provider: "openai", model: "gpt-4.1-mini" },
        openai: { apiKey: process.env.OPENAI_API_KEY },
        pglite: { dataDir: process.env.TURBOMEM_DATA_DIR ?? ".turbomem" },
      });
      await memory.init();
      instance = memory;
      return memory;
    })();
  }
  return initPromise;
}
