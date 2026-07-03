import { TurboMemory } from "turbomem";

let instance: TurboMemory | null = null;
let initPromise: Promise<TurboMemory> | null = null;

const storage = process.env.TURBOMEM_STORAGE ?? "pglite";

function createMemory(): TurboMemory {
  const base = {
    embeddings: "openai" as const,
    extraction: { provider: "openai" as const, model: "gpt-4.1-mini" },
    openai: { apiKey: process.env.OPENAI_API_KEY },
  };

  if (storage === "upstash-vector") {
    return new TurboMemory({
      ...base,
      storage: "upstash-vector",
      upstashVector: {
        url: process.env.UPSTASH_VECTOR_REST_URL,
        token: process.env.UPSTASH_VECTOR_REST_TOKEN,
      },
    });
  }

  return new TurboMemory({
    ...base,
    storage: "pglite",
    pglite: { dataDir: process.env.TURBOMEM_DATA_DIR ?? ".turbomem" },
  });
}

/**
 * Lazily create and initialise a single shared TurboMemory instance.
 *
 * Local dev (default): PGlite on disk — just set OPENAI_API_KEY.
 * Vercel / serverless: set TURBOMEM_STORAGE=upstash-vector plus Upstash env vars.
 */
export async function getMemory(): Promise<TurboMemory> {
  if (instance) return instance;
  if (!initPromise) {
    initPromise = (async () => {
      const memory = createMemory();
      await memory.init();
      instance = memory;
      return memory;
    })();
  }
  return initPromise;
}
