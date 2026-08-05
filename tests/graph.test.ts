import { describe, it, expect } from "vitest";
import { buildKnowledgeGraph, layoutGraph } from "../src/core/graph/builder.js";
import type { MemoryEntry } from "../src/core/memory/types.js";

function mem(
  partial: Partial<MemoryEntry> & { id: string; title: string },
): MemoryEntry {
  return {
    type: "note",
    content: partial.content || partial.title,
    files: [],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  } as MemoryEntry;
}

describe("knowledge graph", () => {
  it("builds nodes and edges from memories", () => {
    const graph = buildKnowledgeGraph([
      mem({ id: "1", title: "Use SQLite", type: "decision", tags: ["db"] }),
      mem({
        id: "2",
        title: "JWT auth",
        type: "security",
        tags: ["auth", "db"],
      }),
    ]);
    expect(graph.stats.memories).toBe(2);
    expect(graph.stats.types).toBeGreaterThanOrEqual(2);
    expect(graph.stats.tags).toBeGreaterThanOrEqual(2);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("layouts nodes with coordinates", () => {
    const graph = buildKnowledgeGraph([
      mem({ id: "a", title: "A", type: "note", tags: ["x"] }),
    ]);
    const laid = layoutGraph(graph, 400, 300);
    expect(laid.nodes[0].x).toBeGreaterThan(0);
    expect(laid.nodes[0].y).toBeGreaterThan(0);
  });
});
