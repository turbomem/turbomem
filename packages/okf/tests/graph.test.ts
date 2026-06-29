import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBundle } from "../src/parser.js";
import { buildGraph, reachableFrom } from "../src/graph.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures/sales");

describe("buildGraph", () => {
  it("creates nodes for every document", async () => {
    const bundle = await parseBundle(FIXTURE);
    const graph = buildGraph(bundle);
    expect(graph.nodes.size).toBe(bundle.documents.length);
  });

  it("wires edges from cross-links", async () => {
    const bundle = await parseBundle(FIXTURE);
    const graph = buildGraph(bundle);

    const ordersNode = graph.nodes.get("tables/orders.md");
    expect(ordersNode?.outgoing.length).toBe(1);
    expect(ordersNode?.outgoing[0]?.to.relativePath).toBe("tables/customers.md");

    const customersNode = graph.nodes.get("tables/customers.md");
    expect(customersNode?.incoming.length).toBe(1);
  });

  it("finds reachable documents via BFS", async () => {
    const bundle = await parseBundle(FIXTURE);
    const graph = buildGraph(bundle);

    const reachable = reachableFrom(graph, "metrics/weekly_active_users.md");
    expect(reachable).toContain("metrics/weekly_active_users.md");
    expect(reachable).toContain("tables/orders.md");
    expect(reachable).toContain("tables/customers.md");
  });
});
