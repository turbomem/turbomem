import path from "node:path";
import fs from "node:fs/promises";
import matter from "gray-matter";
import fg from "fast-glob";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import type { OKFBundle, OKFDocument, OKFLink, OKFFrontmatter, ParseOptions } from "./types.js";

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function resolveLinkHref(href: string, documentPath: string, bundleRoot: string): string {
  const withoutFragment = href.split("#")[0] ?? href;
  if (withoutFragment.startsWith("/")) {
    return path.join(bundleRoot, withoutFragment.slice(1));
  }
  return path.resolve(path.dirname(documentPath), withoutFragment);
}

function extractLinks(
  body: string,
  documentPath: string,
  bundleRoot: string,
  followLinks: boolean,
): OKFLink[] {
  const links: OKFLink[] = [];
  const tree = unified().use(remarkParse).parse(body);

  visit(tree, "link", (node) => {
    const linkNode = node as { url: string; children?: Array<{ type?: string; value?: string }> };
    const href = linkNode.url;
    const text = linkNode.children?.[0]?.type === "text" ? (linkNode.children[0].value ?? "") : "";

    if (href.startsWith("http://") || href.startsWith("https://")) {
      links.push({ text, href });
      return;
    }

    const link: OKFLink = { text, href };
    if (followLinks) {
      const resolvedAbsolute = resolveLinkHref(href, documentPath, bundleRoot);
      link.resolvedPath = normalizeRelativePath(path.relative(bundleRoot, resolvedAbsolute));
    }
    links.push(link);
  });

  return links;
}

function normalizeFrontmatter(data: Record<string, unknown>): OKFFrontmatter {
  const normalized = { ...data };
  if (normalized.timestamp instanceof Date) {
    normalized.timestamp = normalized.timestamp.toISOString();
  }
  return normalized as OKFFrontmatter;
}

export async function parseDocument(filePath: string, bundleRoot: string, options: ParseOptions = {}): Promise<OKFDocument> {
  const { followLinks = true } = options;
  const raw = await fs.readFile(filePath, "utf-8");
  const { data, content } = matter(raw);

  const relativePath = normalizeRelativePath(path.relative(bundleRoot, filePath));
  const links = extractLinks(content, filePath, bundleRoot, followLinks);

  return {
    path: filePath,
    relativePath,
    frontmatter: normalizeFrontmatter(data as Record<string, unknown>),
    body: content,
    links,
  };
}

export async function parseBundle(rootDir: string, options: ParseOptions = {}): Promise<OKFBundle> {
  const absoluteRoot = path.resolve(rootDir);
  const ignorePatterns = options.ignore ?? [];

  const filePaths = await fg("**/*.md", {
    cwd: absoluteRoot,
    absolute: true,
    ignore: ignorePatterns,
  });

  const documents = await Promise.all(
    filePaths.map((fp) => parseDocument(fp, absoluteRoot, options)),
  );

  const index = new Map<string, OKFDocument>();
  for (const doc of documents) {
    index.set(doc.relativePath, doc);
  }

  return { root: absoluteRoot, documents, index };
}
