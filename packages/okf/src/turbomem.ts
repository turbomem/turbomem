import type { OKFBundle, OKFDocument } from "./types.js";

export interface OKFMemoryScope {
  userId?: string;
  agentId?: string;
  sessionId?: string;
}

export interface OKFMemory {
  addFacts: (facts: string[], scope: OKFMemoryScope) => Promise<unknown[]>;
}

export function documentToFacts(doc: OKFDocument): string[] {
  const facts: string[] = [];
  const fm = doc.frontmatter;

  const parts: string[] = [`[${fm.type}]`];
  if (fm.title) parts.push(fm.title);
  if (fm.description) parts.push("—", fm.description);
  if (fm.resource) parts.push(`(resource: ${fm.resource})`);
  if (fm.tags?.length) parts.push(`tags: ${fm.tags.join(", ")}`);

  facts.push(parts.join(" "));

  const body = doc.body.trim();
  if (body) {
    facts.push(`${fm.title ?? doc.relativePath} details: ${body}`);
  }

  return facts;
}

export function bundleToFacts(bundle: OKFBundle): string[] {
  return bundle.documents.flatMap(documentToFacts);
}

export async function addFromBundle(
  memory: OKFMemory,
  bundle: OKFBundle,
  scope: OKFMemoryScope = {},
): Promise<unknown[]> {
  const facts = bundleToFacts(bundle);
  if (facts.length === 0) return [];
  return memory.addFacts(facts, scope);
}
