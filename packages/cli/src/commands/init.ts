import type { Command } from "commander";
import { cancel, intro, isCancel, outro, password, select, text } from "@clack/prompts";
import {
  DEFAULT_DATA_DIR,
  loadConfigFile,
  saveConfigFile,
  type CliConfig,
  type EmbeddingsProvider,
  type ExtractionProvider,
} from "../config.js";
import { gradientText, theme } from "../theme.js";

function bail(): never {
  cancel("Setup cancelled.");
  process.exit(0);
}

export function registerInit(program: Command): void {
  program
    .command("init")
    .description("Interactively configure turbomem and write ~/.turbomem/config.json")
    .action(async () => {
      const existing = loadConfigFile();
      intro(`${gradientText("turbomem")} ${theme.dim("setup")}`);

      const embeddings = (await select({
        message: "Embeddings provider",
        initialValue: existing.embeddings ?? "openai",
        options: [
          { value: "openai", label: "OpenAI", hint: "text-embedding-3-small, needs an API key" },
          { value: "local", label: "Local (transformers)", hint: "runs on-device, no API key" },
          { value: "voyage", label: "Voyage AI", hint: "voyage-3.5 / voyage-4, needs an API key" },
          { value: "google", label: "Google Gemini", hint: "gemini-embedding-001, needs an API key" },
        ],
      })) as EmbeddingsProvider;
      if (isCancel(embeddings)) bail();

      let localModel = existing.localModel;
      if (embeddings === "local") {
        const model = await text({
          message: "Local embedding model (leave blank for default)",
          initialValue: existing.localModel ?? "",
          placeholder: "Xenova/all-MiniLM-L6-v2",
        });
        if (isCancel(model)) bail();
        localModel = (model as string).trim() || undefined;
      }

      let embeddingModel = existing.embeddingModel;
      if (embeddings === "voyage" || embeddings === "google") {
        const placeholder = embeddings === "voyage" ? "voyage-3.5" : "gemini-embedding-001";
        const model = await text({
          message: `Embedding model (leave blank for default)`,
          initialValue: existing.embeddingModel ?? "",
          placeholder,
        });
        if (isCancel(model)) bail();
        embeddingModel = (model as string).trim() || undefined;
      }

      const extractionProvider = (await select({
        message: "Fact-extraction provider",
        initialValue: existing.extractionProvider ?? "openai",
        options: [
          { value: "openai", label: "OpenAI", hint: "e.g. gpt-4o-mini" },
          { value: "anthropic", label: "Anthropic", hint: "e.g. claude-3-5-haiku-latest" },
          { value: "google", label: "Google Gemini", hint: "e.g. gemini-2.5-flash" },
        ],
      })) as ExtractionProvider;
      if (isCancel(extractionProvider)) bail();

      const defaultExtractionModel: Record<ExtractionProvider, string> = {
        openai: "gpt-4o-mini",
        anthropic: "claude-3-5-haiku-latest",
        google: "gemini-2.5-flash",
      };
      const defaultModel = existing.extractionModel ?? defaultExtractionModel[extractionProvider];
      const extractionModel = await text({
        message: "Extraction model",
        initialValue: defaultModel,
      });
      if (isCancel(extractionModel)) bail();

      let openaiApiKey = existing.openaiApiKey;
      if (embeddings === "openai" || extractionProvider === "openai") {
        const key = await password({
          message: `OpenAI API key${existing.openaiApiKey ? " (leave blank to keep existing)" : ""}`,
        });
        if (isCancel(key)) bail();
        if ((key as string).trim()) openaiApiKey = (key as string).trim();
      }

      let anthropicApiKey = existing.anthropicApiKey;
      if (extractionProvider === "anthropic") {
        const key = await password({
          message: `Anthropic API key${existing.anthropicApiKey ? " (leave blank to keep existing)" : ""}`,
        });
        if (isCancel(key)) bail();
        if ((key as string).trim()) anthropicApiKey = (key as string).trim();
      }

      let voyageApiKey = existing.voyageApiKey;
      if (embeddings === "voyage") {
        const key = await password({
          message: `Voyage API key${existing.voyageApiKey ? " (leave blank to keep existing)" : ""}`,
        });
        if (isCancel(key)) bail();
        if ((key as string).trim()) voyageApiKey = (key as string).trim();
      }

      let googleApiKey = existing.googleApiKey;
      if (embeddings === "google" || extractionProvider === "google") {
        const key = await password({
          message: `Google (Gemini) API key${existing.googleApiKey ? " (leave blank to keep existing)" : ""}`,
        });
        if (isCancel(key)) bail();
        if ((key as string).trim()) googleApiKey = (key as string).trim();
      }

      const dataDir = await text({
        message: "Data directory",
        initialValue: existing.dataDir ?? DEFAULT_DATA_DIR,
      });
      if (isCancel(dataDir)) bail();

      const config: CliConfig = {
        embeddings,
        localModel,
        embeddingModel,
        extractionProvider,
        extractionModel: (extractionModel as string).trim(),
        openaiApiKey,
        anthropicApiKey,
        voyageApiKey,
        googleApiKey,
        dataDir: (dataDir as string).trim(),
      };

      saveConfigFile(config);
      outro(`${theme.success("✔")} Saved configuration. Try ${theme.accent("turbomem add \"...\"")}`);
    });
}
