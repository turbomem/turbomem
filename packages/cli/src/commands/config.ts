import type { Command } from "commander";
import { CONFIG_PATH, hasConfigFile, resolveConfig } from "../config.js";
import { theme } from "../theme.js";
import { getOverrides } from "./helpers.js";

function mask(value?: string): string {
  if (!value) return theme.dim("(not set)");
  if (value.length <= 8) return theme.dim("••••");
  return theme.dim(`${value.slice(0, 4)}…${value.slice(-4)}`);
}

export function registerConfig(program: Command): void {
  program
    .command("config")
    .description("Show the resolved configuration and its file location")
    .action((_opts: unknown, command: Command) => {
      const resolved = resolveConfig(getOverrides(command));
      const row = (label: string, value: string) => `  ${theme.label(label.padEnd(20))} ${value}`;

      console.log(theme.accentBold("\nturbomem config"));
      console.log(
        theme.dim(`  file: ${CONFIG_PATH}${hasConfigFile() ? "" : " (not created — run `turbomem init`)"}`),
      );
      console.log("");
      console.log(row("embeddings", resolved.embeddings));
      if (resolved.localModel) console.log(row("local model", resolved.localModel));
      console.log(row("extraction", `${resolved.extractionProvider} (${resolved.extractionModel})`));
      console.log(row("data dir", resolved.dataDir));
      console.log(row("openai key", mask(resolved.openaiApiKey)));
      console.log(row("anthropic key", mask(resolved.anthropicApiKey)));
      console.log("");
    });
}
