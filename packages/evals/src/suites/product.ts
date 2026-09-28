import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { OpenAIEmbeddingAdapter, type EmbeddingAdapter, type Message } from "turbomem";
import type OpenAI from "openai";
import { PRODUCT_DATASETS_DIR } from "../paths.js";
import { createRuntime, type EvalRuntime, type RunnerOptions } from "../runner.js";
import { HashEmbeddingAdapter } from "../embeddings/hash.js";
import { recallAtK, reciprocalRank, meanMetric } from "../scoring/ir.js";
import { latencyStats, timeMs } from "../scoring/latency.js";
import { cosineExtractionScore, llmJudgeExtraction } from "../scoring/llm-judge.js";
import { createOpenAi, TokenCounter } from "../openai.js";
import type {
  DedupResult,
  ExtractionResult,
  ProductSuiteResult,
  RetrievalResult,
  ScopingResult,
} from "../results/schema.js";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
});

const ExtractionFileSchema = z.object({
  cases: z.array(
    z.object({
      id: z.string(),
      messages: z.array(MessageSchema),
      goldFacts: z.array(z.string()),
    }),
  ),
});

const RetrievalFileSchema = z.object({
  cases: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      facts: z.array(z.string()),
      queries: z.array(
        z.object({
          query: z.string(),
          smokeQuery: z.string().optional(),
          relevant: z.array(z.string()),
        }),
      ),
    }),
  ),
});

const DedupFileSchema = z.object({
  cases: z.array(
    z.object({
      id: z.string(),
      strategy: z.enum(["merge", "replace", "skip"]),
      userId: z.string(),
      writes: z.array(z.string()),
      expectCount: z.number().int().positive(),
      mustContain: z.array(z.string()),
      liveOnly: z.boolean().optional(),
    }),
  ),
});

const ScopingFileSchema = z.object({
  cases: z.array(
    z.object({
      id: z.string(),
      writes: z.array(
        z.object({
          userId: z.string(),
          sessionId: z.string().optional(),
          facts: z.array(z.string()),
        }),
      ),
      searches: z.array(
        z.object({
          query: z.string(),
          scope: z.object({
            userId: z.string().optional(),
            sessionId: z.string().optional(),
          }),
          mustIncludeUserIds: z.array(z.string()).optional(),
          mustExcludeUserIds: z.array(z.string()).optional(),
          expectEmpty: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

function loadJson<T>(name: string, schema: z.ZodType<T>): T {
  const raw = readFileSync(join(PRODUCT_DATASETS_DIR, name), "utf8");
  return schema.parse(JSON.parse(raw));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function embeddingForConfig(runtime: EvalRuntime): EmbeddingAdapter {
  if (runtime.config.embeddings === "openai") {
    return new OpenAIEmbeddingAdapter({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return new HashEmbeddingAdapter();
}

async function runExtraction(
  runtime: EvalRuntime,
  client: OpenAI | null,
  tokens: TokenCounter,
): Promise<ExtractionResult | null> {
  if (runtime.smoke) return null;

  const { cases } = loadJson("extraction.json", ExtractionFileSchema);
  const embedder = embeddingForConfig(runtime);
  const judgeScores: { precision: number; recall: number; f1: number }[] = [];
  const cosineScores: { precision: number; recall: number; f1: number }[] = [];

  for (const c of cases) {
    const userId = `extract_${c.id}`;
    await runtime.memory.deleteAll({ userId });
    const created = await runtime.memory.add(c.messages as Message[], { userId });
    const extracted = created.map((m) => m.content);

    const [goldVecs, extractedVecs] = await Promise.all([
      embedder.embedBatch(c.goldFacts),
      extracted.length > 0 ? embedder.embedBatch(extracted) : Promise.resolve([]),
    ]);
    cosineScores.push(cosineExtractionScore(goldVecs, extractedVecs));

    if (client && runtime.config.judgeModel) {
      judgeScores.push(
        await llmJudgeExtraction(client, {
          model: runtime.config.judgeModel,
          gold: c.goldFacts,
          extracted,
          tokens,
        }),
      );
    }
  }

  const primary = judgeScores.length > 0 ? judgeScores : cosineScores;
  return {
    n: cases.length,
    precision: round4(mean(primary.map((s) => s.precision))),
    recall: round4(mean(primary.map((s) => s.recall))),
    f1: round4(mean(primary.map((s) => s.f1))),
    cosinePrecision: round4(mean(cosineScores.map((s) => s.precision))),
    cosineRecall: round4(mean(cosineScores.map((s) => s.recall))),
    judgeModel: runtime.config.judgeModel,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

async function runRetrieval(runtime: EvalRuntime): Promise<RetrievalResult> {
  const { cases } = loadJson("retrieval.json", RetrievalFileSchema);
  const r1: number[] = [];
  const r5: number[] = [];
  const mrr: number[] = [];

  for (const c of cases) {
    await runtime.memory.deleteAll({ userId: c.userId });
    await runtime.memory.addFacts(c.facts, { userId: c.userId });

    for (const q of c.queries) {
      const query = runtime.smoke && q.smokeQuery ? q.smokeQuery : q.query;
      const results = await runtime.memory.search(query, {
        userId: c.userId,
        limit: runtime.config.searchLimit,
      });
      const ranked = results.map((r) => r.memory.content);
      r1.push(recallAtK(ranked, q.relevant, 1));
      r5.push(recallAtK(ranked, q.relevant, 5));
      mrr.push(reciprocalRank(ranked, q.relevant));
    }
  }

  return {
    n: r1.length,
    recallAt1: round4(meanMetric(r1)),
    recallAt5: round4(meanMetric(r5)),
    mrr: round4(meanMetric(mrr)),
  };
}

async function runDedup(base: RunnerOptions): Promise<DedupResult> {
  const { cases } = loadJson("dedup.json", DedupFileSchema);
  let ok = 0;
  let n = 0;

  for (const c of cases) {
    if (c.liveOnly && base.smoke) continue;
    n++;
    const runtime = await createRuntime({
      ...base,
      deduplication: { enabled: true, strategy: c.strategy },
    });
    try {
      await runtime.memory.addFacts(c.writes, { userId: c.userId });
      const stored = await runtime.memory.getAll({ userId: c.userId });
      const contents = stored.map((m) => m.content);
      const countOk = stored.length === c.expectCount;
      const containsOk = c.mustContain.every((fact) =>
        contents.some(
          (x) =>
            x.toLowerCase().includes(fact.toLowerCase()) || fact.toLowerCase().includes(x.toLowerCase()),
        ),
      );
      if (countOk && containsOk) ok++;
    } finally {
      await runtime.close();
    }
  }

  return { n, accuracy: round4(n === 0 ? 1 : ok / n) };
}

async function runScoping(runtime: EvalRuntime): Promise<ScopingResult> {
  const { cases } = loadJson("scoping.json", ScopingFileSchema);
  let checks = 0;
  let leaks = 0;
  let passed = 0;

  for (const c of cases) {
    for (const w of c.writes) {
      await runtime.memory.deleteAll({ userId: w.userId, sessionId: w.sessionId });
      await runtime.memory.addFacts(w.facts, { userId: w.userId, sessionId: w.sessionId });
    }

    for (const s of c.searches) {
      const results = await runtime.memory.search(s.query, {
        ...s.scope,
        limit: runtime.config.searchLimit,
      });
      checks++;
      let ok = true;
      if (s.expectEmpty) {
        if (results.length > 0) {
          ok = false;
          leaks++;
        }
      }
      for (const uid of s.mustIncludeUserIds ?? []) {
        if (!results.some((r) => r.memory.userId === uid)) ok = false;
      }
      for (const uid of s.mustExcludeUserIds ?? []) {
        if (results.some((r) => r.memory.userId === uid)) {
          ok = false;
          leaks++;
        }
      }
      if (ok) passed++;
    }
  }

  return {
    n: checks,
    leakRate: round4(checks === 0 ? 0 : leaks / checks),
    isolationAccuracy: round4(checks === 0 ? 1 : passed / checks),
  };
}

async function runLatency(runtime: EvalRuntime): Promise<NonNullable<ProductSuiteResult["latency"]>> {
  const userId = "latency_user";
  await runtime.memory.deleteAll({ userId });
  const facts = Array.from(
    { length: 12 },
    (_, i) => `The user has latency fact number ${i} about topic ${i % 4}`,
  );
  const addSamples: number[] = [];
  for (const fact of facts) {
    const { ms } = await timeMs(() => runtime.memory.addFacts([fact], { userId }));
    addSamples.push(ms);
  }
  const searchSamples: number[] = [];
  const queries = ["topic 0", "topic 1", "fact number", "latency fact", "topic 3"];
  for (const q of queries) {
    const { ms } = await timeMs(() => runtime.memory.search(q, { userId, limit: 5 }));
    searchSamples.push(ms);
  }
  return { add: latencyStats(addSamples), search: latencyStats(searchSamples) };
}

export async function runProductSuite(options: RunnerOptions): Promise<ProductSuiteResult> {
  const runtime = await createRuntime({
    ...options,
    deduplication: { enabled: false },
  });
  const tokens = new TokenCounter();
  const client = !options.smoke && process.env.OPENAI_API_KEY ? createOpenAi() : null;

  try {
    const retrieval = await runRetrieval(runtime);
    const scoping = await runScoping(runtime);
    const latency = await runLatency(runtime);
    const extraction = await runExtraction(runtime, client, tokens);
    const dedup = await runDedup(options);
    return { extraction, retrieval, dedup, scoping, latency };
  } finally {
    await runtime.close();
  }
}
