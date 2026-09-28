import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import type { Message } from "turbomem";
import { LOCOMO_DATA_PATH } from "../paths.js";
import { createRuntime, type RunnerOptions } from "../runner.js";
import { scoreLocomoQa, mean, categoryName } from "../scoring/locomo-f1.js";
import { latencyStats, timeMs } from "../scoring/latency.js";
import { answerFromMemories } from "../scoring/llm-judge.js";
import { createOpenAi, requireOpenAiKey, TokenCounter } from "../openai.js";
import type { LocomoCategoryId, LocomoCategoryResult, LocomoSuiteResult } from "../results/schema.js";

const SMOKE_CONVERSATIONS = 1;
const SMOKE_QA_LIMIT = 20;

const stringOrStringList = z.union([z.string(), z.array(z.string())]).optional();

const TurnSchema = z.object({
  speaker: z.string().optional(),
  text: z.string().optional(),
  dia_id: z.string().optional(),
  blip_caption: stringOrStringList,
  img_url: stringOrStringList,
}).passthrough();

function joinCaptions(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? value.filter(Boolean).join("; ") : value;
}

const QaSchema = z.object({
  question: z.string(),
  answer: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  category: z.number().int(),
  evidence: z.array(z.string()).optional(),
}).passthrough();

const SampleSchema = z.object({
  sample_id: z.string().optional(),
  conversation: z.record(z.unknown()),
  qa: z.array(QaSchema).optional(),
}).passthrough();

function asCategory(n: number): LocomoCategoryId | null {
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

function goldAnswer(answer: unknown): string {
  if (answer === undefined || answer === null) return "";
  if (Array.isArray(answer)) return answer.join(", ");
  return String(answer);
}

export function sessionsFromConversation(conversation: Record<string, unknown>): Array<{
  index: number;
  dateTime?: string;
  messages: Message[];
}> {
  const speakerA = String(conversation.speaker_a ?? "A");
  const entries: Array<{ index: number; dateTime?: string; messages: Message[] }> = [];

  for (const [key, value] of Object.entries(conversation)) {
    const match = /^session_(\d+)$/.exec(key);
    if (!match || !Array.isArray(value)) continue;
    const index = Number(match[1]);
    const dateRaw = conversation[`session_${index}_date_time`];
    const dateTime = typeof dateRaw === "string" ? dateRaw : undefined;
    const messages: Message[] = [];

    for (const raw of value) {
      const turn = TurnSchema.parse(raw);
      const speaker = turn.speaker ?? "";
      const text = turn.text ?? "";
      const caption = joinCaptions(turn.blip_caption);
      const image = caption ? ` [image: ${caption}]` : "";
      const prefix = dateTime ? `[${dateTime}] ` : "";
      const role: Message["role"] = speaker === speakerA ? "user" : "assistant";
      const content = `${prefix}${speaker}: ${text}${image}`.trim();
      if (content.length > 0) messages.push({ role, content });
    }

    if (messages.length > 0) entries.push({ index, dateTime, messages });
  }

  return entries.sort((a, b) => a.index - b.index);
}

export function locomoDataPathExists(): boolean {
  return existsSync(LOCOMO_DATA_PATH);
}

export async function runLocomoSuite(options: RunnerOptions): Promise<LocomoSuiteResult> {
  if (!locomoDataPathExists()) {
    throw new Error(
      `LoCoMo dataset not found at ${LOCOMO_DATA_PATH}. Run: pnpm --filter @turbomem/evals download-locomo`,
    );
  }
  requireOpenAiKey();

  const raw = JSON.parse(readFileSync(LOCOMO_DATA_PATH, "utf8")) as unknown;
  const samples = z.array(SampleSchema).parse(raw);
  const selected = options.smoke ? samples.slice(0, SMOKE_CONVERSATIONS) : samples;

  const client = createOpenAi();
  const tokens = new TokenCounter();
  const scores: { category: LocomoCategoryId; f1: number }[] = [];
  const searchMs: number[] = [];
  let qaCount = 0;

  const runtime = await createRuntime({ ...options, smoke: false });

  try {
    for (const sample of selected) {
      const userId = `locomo_${sample.sample_id ?? "sample"}`;
      await runtime.memory.deleteAll({ userId });

      const sessions = sessionsFromConversation(sample.conversation);
      for (const session of sessions) {
        await runtime.memory.add(session.messages, { userId });
      }

      const qas = sample.qa ?? [];
      const cap = options.qaLimit ?? (options.smoke ? SMOKE_QA_LIMIT : undefined);
      const limited = cap !== undefined ? qas.slice(0, cap) : qas;

      for (const qa of limited) {
        const category = asCategory(qa.category);
        if (category === null) continue;

        const { value: hits, ms } = await timeMs(() =>
          runtime.memory.search(qa.question, { userId, limit: runtime.config.searchLimit }),
        );
        searchMs.push(ms);

        const memories = hits.map((h) => h.memory.content);
        const prediction = await answerFromMemories(client, {
          model: runtime.config.answerModel,
          question: qa.question,
          memories,
          tokens,
        });

        scores.push({
          category,
          f1: scoreLocomoQa(prediction, goldAnswer(qa.answer), category),
        });
        qaCount++;
      }
    }
  } finally {
    await runtime.close();
  }

  const ids: LocomoCategoryId[] = [1, 2, 3, 4, 5];
  const byCategory: LocomoCategoryResult[] = ids.map((id) => {
    const subset = scores.filter((s) => s.category === id);
    return {
      id,
      name: categoryName(id),
      n: subset.length,
      f1: round4(mean(subset.map((s) => s.f1))),
    };
  });

  return {
    dataset: "locomo10",
    overallF1: round4(mean(scores.map((s) => s.f1))),
    n: qaCount,
    byCategory,
    tokensPerQuery: qaCount === 0 ? null : round4(tokens.total / qaCount),
    latencyMs: searchMs.length === 0 ? null : latencyStats(searchMs),
    conversations: selected.length,
    smoke: Boolean(options.smoke),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
