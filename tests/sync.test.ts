import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { MemoryEngine } from "../src/core/memory/engine.js";
import { exportBundle, importBundle, parseBundle, SYNC_FORMAT } from "../src/core/sync/exchange.js";

describe("sync exchange", () => {
  let dir: string;
  let engine: MemoryEngine;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hex-sync-"));
    engine = new MemoryEngine({ dbPath: path.join(dir, "a.db") });
  });

  afterEach(() => {
    engine.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("exports and re-imports", () => {
    engine.add("Decision", "Use SQLite", { type: "decision", tags: ["db"] });
    const bundle = exportBundle(engine, { source: "test" });
    expect(bundle.format).toBe(SYNC_FORMAT);
    expect(bundle.memories.length).toBeGreaterThanOrEqual(1);

    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "hex-sync2-"));
    const e2 = new MemoryEngine({ dbPath: path.join(dir2, "b.db") });
    const result = importBundle(e2, parseBundle(bundle));
    expect(result.added).toBeGreaterThanOrEqual(1);
    e2.close();
    fs.rmSync(dir2, { recursive: true, force: true });
  });

  it("rejects bad format", () => {
    expect(() => parseBundle({ format: "nope", memories: [] })).toThrow();
  });
});
