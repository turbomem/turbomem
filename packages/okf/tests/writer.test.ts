import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { serializeDocument, writeDocument } from "../src/writer.js";

describe("writer", () => {
  it("serializes frontmatter and body", () => {
    const output = serializeDocument({ type: "Table", title: "Orders" }, "# Orders\n");
    const parsed = matter(output);
    expect(parsed.data.type).toBe("Table");
    expect(parsed.data.title).toBe("Orders");
    expect(parsed.content.trim()).toBe("# Orders");
  });

  it("writes a document to disk", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "okf-write-"));
    const filePath = path.join(dir, "tables", "orders.md");

    await writeDocument(filePath, { type: "Table", title: "Orders" }, "# Orders\n");

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("type: Table");
    expect(content).toContain("# Orders");
  });

  it("throws when file exists and overwrite is false", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "okf-write-"));
    const filePath = path.join(dir, "doc.md");

    await writeDocument(filePath, { type: "Table" }, "# Doc\n");

    await expect(
      writeDocument(filePath, { type: "Table" }, "# Doc\n", { overwrite: false }),
    ).rejects.toThrow(/already exists/);
  });

  it("overwrites when overwrite is true", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "okf-write-"));
    const filePath = path.join(dir, "doc.md");

    await writeDocument(filePath, { type: "Table" }, "# Old\n");
    await writeDocument(filePath, { type: "Table" }, "# New\n", { overwrite: true });

    const content = await fs.readFile(filePath, "utf-8");
    expect(content).toContain("# New");
  });
});
