import { z } from "zod";

export const DEFAULT_EXTRACTION_MODEL = "gpt-4.1-mini";
export const DEFAULT_ANSWER_MODEL = "gpt-4.1-mini";
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_STORAGE = "pglite" as const;

export const LatencyStatsSchema = z.object({
  n: z.number().int().nonnegative(),
  p50Ms: z.number().nonnegative(),
  p95Ms: z.number().nonnegative(),
  meanMs: z.number().nonnegative(),
});
export type LatencyStats = z.infer<typeof LatencyStatsSchema>;

export const ExtractionResultSchema = z.object({
  n: z.number().int().nonnegative(),
  precision: z.number().min(0).max(1),
  recall: z.number().min(0).max(1),
  f1: z.number().min(0).max(1),
  cosinePrecision: z.number().min(0).max(1).optional(),
  cosineRecall: z.number().min(0).max(1).optional(),
  judgeModel: z.string().optional(),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const RetrievalResultSchema = z.object({
  n: z.number().int().nonnegative(),
  recallAt1: z.number().min(0).max(1),
  recallAt5: z.number().min(0).max(1),
  mrr: z.number().min(0).max(1),
});
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;

export const DedupResultSchema = z.object({
  n: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});
export type DedupResult = z.infer<typeof DedupResultSchema>;

export const ScopingResultSchema = z.object({
  n: z.number().int().nonnegative(),
  leakRate: z.number().min(0).max(1),
  isolationAccuracy: z.number().min(0).max(1),
});
export type ScopingResult = z.infer<typeof ScopingResultSchema>;

export const ProductSuiteResultSchema = z.object({
  extraction: ExtractionResultSchema.nullable(),
  retrieval: RetrievalResultSchema.nullable(),
  dedup: DedupResultSchema.nullable(),
  scoping: ScopingResultSchema.nullable(),
  latency: z
    .object({
      add: LatencyStatsSchema,
      search: LatencyStatsSchema,
    })
    .nullable(),
});
export type ProductSuiteResult = z.infer<typeof ProductSuiteResultSchema>;

export const LocomoCategoryIdSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type LocomoCategoryId = z.infer<typeof LocomoCategoryIdSchema>;

export const LocomoCategoryResultSchema = z.object({
  id: LocomoCategoryIdSchema,
  name: z.string(),
  n: z.number().int().nonnegative(),
  f1: z.number().min(0).max(1),
});
export type LocomoCategoryResult = z.infer<typeof LocomoCategoryResultSchema>;

export const LocomoSuiteResultSchema = z.object({
  dataset: z.literal("locomo10"),
  overallF1: z.number().min(0).max(1),
  n: z.number().int().nonnegative(),
  byCategory: z.array(LocomoCategoryResultSchema),
  tokensPerQuery: z.number().nonnegative().nullable(),
  latencyMs: LatencyStatsSchema.nullable(),
  conversations: z.number().int().nonnegative(),
  smoke: z.boolean(),
});
export type LocomoSuiteResult = z.infer<typeof LocomoSuiteResultSchema>;

export const EvalConfigSchema = z.object({
  embeddings: z.enum(["openai", "hash"]),
  embeddingModel: z.string(),
  extractionModel: z.string(),
  answerModel: z.string(),
  storage: z.literal("pglite"),
  searchLimit: z.number().int().positive(),
  judgeModel: z.string().optional(),
});
export type EvalConfig = z.infer<typeof EvalConfigSchema>;

export const EvalSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  date: z.string(),
  gitSha: z.string(),
  /** True only for a deliberately frozen public snapshot. */
  published: z.boolean(),
  config: EvalConfigSchema,
  suites: z.object({
    product: ProductSuiteResultSchema.nullable(),
    locomo: LocomoSuiteResultSchema.nullable(),
  }),
  notes: z.string().optional(),
});
export type EvalSnapshot = z.infer<typeof EvalSnapshotSchema>;

export const LOCOMO_CATEGORY_NAMES: Record<LocomoCategoryId, string> = {
  1: "multi-hop",
  2: "temporal",
  3: "open-domain",
  4: "single-hop",
  5: "adversarial",
};
