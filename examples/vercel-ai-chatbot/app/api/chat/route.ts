import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createMemoryTools } from "@turbomem/vercel-ai";
import { getMemory } from "../../../lib/memory";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, userId } = await req.json();

  const memory = await getMemory();
  const tools = createMemoryTools(memory, { userId: userId ?? "anonymous" });

  const result = await streamText({
    model: openai("gpt-4.1-mini"),
    system:
      "You are a helpful assistant with long-term memory. " +
      "Use `recallMemories` to look up what you know about the user before answering, " +
      "and `rememberFact` to store durable facts they share about themselves.",
    messages,
    tools,
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
