function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function uniqueTokenSet(text: string): Set<string> {
  return new Set(
    tokenize(text)
      .map((t) => t.toLowerCase().replace(/[^\w]/g, ""))
      .filter(Boolean),
  );
}

/** Higher score = more specific / information-dense. */
export function specificityScore(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return 0;

  const unique = new Set(tokens.map((t) => t.toLowerCase()));
  const density = unique.size / tokens.length;
  const concisenessBonus = 1 / Math.sqrt(trimmed.length);

  return density * concisenessBonus;
}

/** True when `incoming` is more specific than `existing`. */
export function isMoreSpecific(incoming: string, existing: string): boolean {
  const incomingTokens = uniqueTokenSet(incoming);
  const existingTokens = uniqueTokenSet(existing);

  if (incomingTokens.size === 0) return false;
  if (existingTokens.size === 0) return true;

  const incomingAddsInfo = [...incomingTokens].some((t) => !existingTokens.has(t));
  const existingIsSubset = [...existingTokens].every((t) => incomingTokens.has(t));
  const incomingIsSubset = [...incomingTokens].every((t) => existingTokens.has(t));

  // Refinement: incoming preserves existing details and adds new ones.
  if (incomingAddsInfo && existingIsSubset) {
    return true;
  }

  // Generalization: incoming drops detail present in existing.
  if (incomingIsSubset && !existingIsSubset) {
    return false;
  }

  // More unique tokens generally means more specific when neither is a subset.
  if (incomingTokens.size !== existingTokens.size) {
    return incomingTokens.size > existingTokens.size;
  }

  const incomingScore = specificityScore(incoming);
  const existingScore = specificityScore(existing);
  if (incomingScore !== existingScore) {
    return incomingScore > existingScore;
  }

  return incoming.trim().length < existing.trim().length;
}
