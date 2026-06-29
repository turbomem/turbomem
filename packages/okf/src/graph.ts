import type { OKFBundle, OKFGraph, OKFNode, OKFEdge } from "./types.js";

export function buildGraph(bundle: OKFBundle): OKFGraph {
  const nodes = new Map<string, OKFNode>();
  const edges: OKFEdge[] = [];

  for (const doc of bundle.documents) {
    nodes.set(doc.relativePath, {
      document: doc,
      outgoing: [],
      incoming: [],
    });
  }

  for (const doc of bundle.documents) {
    const fromNode = nodes.get(doc.relativePath)!;

    for (const link of doc.links) {
      if (!link.resolvedPath) continue;
      const toNode = nodes.get(link.resolvedPath);
      if (!toNode) continue;

      const edge: OKFEdge = {
        from: doc,
        to: toNode.document,
        linkText: link.text,
      };

      edges.push(edge);
      fromNode.outgoing.push(edge);
      toNode.incoming.push(edge);
    }
  }

  return { nodes, edges };
}

export function reachableFrom(graph: OKFGraph, startRelativePath: string): string[] {
  const visited = new Set<string>();
  const queue = [startRelativePath];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const node = graph.nodes.get(current);
    if (!node) continue;

    for (const edge of node.outgoing) {
      queue.push(edge.to.relativePath);
    }
  }

  return [...visited];
}
