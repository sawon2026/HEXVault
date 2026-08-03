import { describe, it, expect } from "vitest";
import { simpleEmbed, cosineSimilarity, InMemoryVectorIndex } from "../src/core/vector/embeddings.js";

describe("embeddings", () => {
  it("produces normalized vectors", () => {
    const v = simpleEmbed("hello world auth security");
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("similar texts score higher", () => {
    const a = simpleEmbed("JWT authentication middleware");
    const b = simpleEmbed("JWT auth middleware tokens");
    const c = simpleEmbed("completely unrelated gardening tips");
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c));
  });

  it("vector index search works", () => {
    const idx = new InMemoryVectorIndex();
    idx.add("1", "sqlite memory vault");
    idx.add("2", "kubernetes cluster scaling");
    const hits = idx.search("memory database sqlite", 2);
    expect(hits[0].id).toBe("1");
  });
});
