import { describe, it, expect } from "vitest";
import { buildKnowledgeGraph, layoutGraph } from "../src/core/graph/builder.js";
import type { MemoryEntry } from "../src/core/memory/types.js";

function mem(p: Partial<MemoryEntry> & { id: string; title: string }): MemoryEntry {
  return {
    type: "note",
    content: p.content || p.title,
    files: [],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...p,
  } as MemoryEntry;
}

describe("knowledge graph", () => {
  it("builds nodes and edges", () => {
    const graph = buildKnowledgeGraph([
      mem({ id: "1", title: "Use SQLite", type: "decision", tags: ["db"] }),
      mem({ id: "2", title: "JWT auth", type: "security", tags: ["auth", "db"] }),
    ]);
    expect(graph.stats.memories).toBe(2);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("layouts coordinates", () => {
    const graph = buildKnowledgeGraph([mem({ id: "a", title: "A", tags: ["x"] })]);
    const laid = layoutGraph(graph, 400, 300);
    expect(laid.nodes[0].x).toBeGreaterThan(0);
  });
});
