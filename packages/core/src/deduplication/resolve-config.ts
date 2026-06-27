import type { DeduplicationConfig } from "../types.js";

export interface ResolvedDeduplicationConfig {
  enabled: boolean;
  threshold: number;
  strategy: "replace" | "skip" | "merge";
  mergeTopK: number;
}

const DEFAULT_THRESHOLD = 0.92;
const DEFAULT_MERGE_TOP_K = 5;

export function resolveDeduplicationConfig(
  config?: DeduplicationConfig,
): ResolvedDeduplicationConfig {
  return {
    enabled: config?.enabled ?? true,
    threshold: config?.threshold ?? DEFAULT_THRESHOLD,
    strategy: config?.strategy ?? "merge",
    mergeTopK: config?.mergeTopK ?? DEFAULT_MERGE_TOP_K,
  };
}
