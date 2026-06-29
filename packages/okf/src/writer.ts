import path from "node:path";
import fs from "node:fs/promises";
import matter from "gray-matter";
import type { OKFFrontmatter, WriteOptions } from "./types.js";

export function serializeDocument(frontmatter: OKFFrontmatter, body: string): string {
  return matter.stringify(body, frontmatter as Record<string, unknown>);
}

export async function writeDocument(
  outputPath: string,
  frontmatter: OKFFrontmatter,
  body: string,
  options: WriteOptions = {},
): Promise<void> {
  const { overwrite = false } = options;

  let exists = false;
  try {
    await fs.access(outputPath);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists && !overwrite) {
    throw new Error(`File already exists: ${outputPath}. Pass overwrite: true to replace it.`);
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const content = serializeDocument(frontmatter, body);
  await fs.writeFile(outputPath, content, "utf-8");
}

export async function writeIndex(
  dirPath: string,
  title: string,
  description: string,
  options: WriteOptions = {},
): Promise<void> {
  const indexPath = path.join(dirPath, "index.md");
  await writeDocument(
    indexPath,
    { type: "index", title, description },
    `# ${title}\n\n${description}\n`,
    options,
  );
}
