import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { MemoryEngine } from "../src/core/memory/engine.js";

describe("MemoryEngine", () => {
  let dir: string;
  let engine: MemoryEngine;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hexvault-test-"));
    engine = new MemoryEngine({ dbPath: path.join(dir, "test.db") });
  });

  afterEach(() => {
    engine.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("adds and lists memories", () => {
    const e = engine.add("Use SQLite", "Local first storage", { type: "decision" });
    expect(e.id).toBeTruthy();
    expect(engine.list(10).length).toBeGreaterThanOrEqual(1);
  });

  it("hybrid search returns ranked results", () => {
    engine.add("Auth JWT", "Short lived tokens", { type: "security", tags: ["auth"] });
    engine.add("UI colors", "Use slate palette", { type: "note" });
    const hits = engine.hybridSearch("auth token", 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].rankScore).toBeGreaterThan(0);
  });

  it("deduplicates near-identical content", () => {
    const a = engine.add("Same title", "Identical body content here", { type: "note" });
    const b = engine.add("Same title", "Identical body content here", { type: "note" });
    expect(a.id).toBe(b.id);
  });

  it("analytics returns totals", () => {
    engine.add("A", "B", { type: "decision" });
    expect(engine.analytics().total).toBeGreaterThanOrEqual(1);
  });
});
