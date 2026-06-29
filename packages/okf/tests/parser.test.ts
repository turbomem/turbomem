import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBundle } from "../src/parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures/sales");

describe("parseBundle", () => {
  it("parses all markdown files in a bundle", async () => {
    const bundle = await parseBundle(FIXTURE);
    expect(bundle.documents.length).toBe(4);
  });

  it("extracts frontmatter correctly", async () => {
    const bundle = await parseBundle(FIXTURE);
    const orders = bundle.index.get("tables/orders.md");
    expect(orders?.frontmatter.type).toBe("BigQuery Table");
    expect(orders?.frontmatter.title).toBe("Orders");
  });

  it("extracts cross-links from body", async () => {
    const bundle = await parseBundle(FIXTURE);
    const orders = bundle.index.get("tables/orders.md");
    expect(orders?.links.length).toBeGreaterThan(0);
    expect(orders?.links[0]?.resolvedPath).toBe("tables/customers.md");
  });

  it("normalizes relative paths with forward slashes", async () => {
    const bundle = await parseBundle(FIXTURE);
    for (const doc of bundle.documents) {
      expect(doc.relativePath).not.toMatch(/\\/);
    }
  });
});
