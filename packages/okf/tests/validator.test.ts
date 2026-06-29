import { describe, it, expect } from "vitest";
import { validateDocument } from "../src/validator.js";
import type { OKFDocument } from "../src/types.js";

const makeDoc = (frontmatter: object, body = "# Orders\n\nSome content."): OKFDocument => ({
  path: "/bundle/tables/orders.md",
  relativePath: "tables/orders.md",
  frontmatter: frontmatter as OKFDocument["frontmatter"],
  body,
  links: [],
});

describe("validateDocument", () => {
  it("passes a valid document", () => {
    const { errors } = validateDocument(makeDoc({ type: "BigQuery Table", title: "Orders" }));
    expect(errors).toHaveLength(0);
  });

  it("fails when type is missing", () => {
    const { errors } = validateDocument(makeDoc({ title: "Orders" }));
    expect(errors.some((e) => e.rule === "frontmatter-schema")).toBe(true);
  });

  it("fails on invalid timestamp", () => {
    const { errors } = validateDocument(makeDoc({ type: "Table", timestamp: "not-a-date" }));
    expect(errors.some((e) => e.rule === "timestamp-format")).toBe(true);
  });

  it("warns on empty body", () => {
    const { warnings } = validateDocument(makeDoc({ type: "Table" }, "   "));
    expect(warnings.some((w) => w.rule === "empty-body")).toBe(true);
  });
});
