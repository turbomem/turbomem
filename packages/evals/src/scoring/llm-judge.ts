import { z } from "zod";
import { cosineSimilarity } from "turbomem";
import { cosineCovered } from "./ir.js";
import { chatComplete, type TokenCounter } from "../openai.js";
import type OpenAI from "openai";

const JudgeSchema = z.object({
  coveredGold: z.array(z.number().int().nonnegative()),
  supportedExtracted: z.array(z.number().int().nonnegative()),
});

const EXTRACTION_JUDGE_SYSTEM = `You compare extracted memory facts against a gold set.

Return ONLY JSON: {"coveredGold":[indexes],"supportedExtracted":[indexes]}
- coveredGold: gold-fact indexes that are semantically present in the extracted set (paraphrases count).
- supportedExtracted: extracted-fact indexes that are supported by the gold set (not invented).
Indexes are 0-based. Empty arrays are allowed.`;

export const EXTRACTION_COSINE_THRESHOLD = 0.78;

export interface ExtractionScore {
  precision: number;
  recall: number;
  f1: number;
}

export function harmonicF1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export function scoreSets(covered: number, goldN: number, supported: number, extractedN: number): ExtractionScore {
  const recall = goldN === 0 ? 1 : covered / goldN;
  const precision = extractedN === 0 ? (goldN === 0 ? 1 : 0) : supported / extractedN;
  return { precision, recall, f1: harmonicF1(precision, recall) };
}

export function cosineExtractionScore(
  goldEmbeddings: number[][],
  extractedEmbeddings: number[][],
  threshold = EXTRACTION_COSINE_THRESHOLD,
): ExtractionScore {
  const covered = goldEmbeddings.filter((g) =>
    cosineCovered(g, extractedEmbeddings, threshold, cosineSimilarity),
  ).length;
  const supported = extractedEmbeddings.filter((e) =>
    cosineCovered(e, goldEmbeddings, threshold, cosineSimilarity),
  ).length;
  return scoreSets(covered, goldEmbeddings.length, supported, extractedEmbeddings.length);
}

export async function llmJudgeExtraction(
  client: OpenAI,
  options: {
    model: string;
    gold: string[];
    extracted: string[];
    tokens?: TokenCounter;
  },
): Promise<ExtractionScore> {
  const { gold, extracted, model, tokens } = options;
  if (gold.length === 0 && extracted.length === 0) {
    return { precision: 1, recall: 1, f1: 1 };
  }

  const user = [
    "Gold facts:",
    ...gold.map((f, i) => `${i}. ${f}`),
    "",
    "Extracted facts:",
    ...extracted.map((f, i) => `${i}. ${f}`),
  ].join("\n");

  const result = await chatComplete(client, {
    model,
    system: EXTRACTION_JUDGE_SYSTEM,
    user,
  });
  tokens?.add(result);

  let parsed: z.infer<typeof JudgeSchema>;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    parsed = JudgeSchema.parse(JSON.parse(jsonMatch?.[0] ?? result.text));
  } catch {
    return { precision: 0, recall: 0, f1: 0 };
  }

  const covered = new Set(parsed.coveredGold.filter((i) => i >= 0 && i < gold.length)).size;
  const supported = new Set(parsed.supportedExtracted.filter((i) => i >= 0 && i < extracted.length)).size;
  return scoreSets(covered, gold.length, supported, extracted.length);
}

export const LOCOMO_ANSWER_SYSTEM = `You answer questions using ONLY the memory facts below.
Reply with a short answer. No preamble.
If the memories do not contain the answer, reply exactly: no information available`;

export function formatMemoriesForAnswer(contents: string[]): string {
  if (contents.length === 0) return "(no memories retrieved)";
  return contents.map((c, i) => `${i + 1}. ${c}`).join("\n");
}

export async function answerFromMemories(
  client: OpenAI,
  options: {
    model: string;
    question: string;
    memories: string[];
    tokens?: TokenCounter;
  },
): Promise<string> {
  const result = await chatComplete(client, {
    model: options.model,
    system: LOCOMO_ANSWER_SYSTEM,
    user: `Memories:\n${formatMemoriesForAnswer(options.memories)}\n\nQuestion: ${options.question}`,
  });
  options.tokens?.add(result);
  return result.text.trim();
}
