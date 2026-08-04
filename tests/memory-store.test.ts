import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { MemoryStore } from "../src/core/memory/store.js";

describe("MemoryStore", () => {
  let dir: string;
  let store: MemoryStore;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hex-store-"));
    store = new MemoryStore({ dbPath: path.join(dir, "m.db") });
  });

  afterEach(() => {
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("add get list search delete", () => {
    const e = store.add("Title", "Body content about sqlite", {
      type: "decision",
      tags: ["db"],
      source: "test",
    });
    expect(store.get(e.id)?.title).toBe("Title");
    expect(store.list(10).length).toBe(1);
    expect(store.list(10, "decision").length).toBe(1);
    const hits = store.search("sqlite", 5);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(store.stats().total).toBe(1);
    expect(store.delete(e.id)).toBe(true);
  });

  it("search empty returns empty", () => {
    expect(store.search("zzzz-nothing", 5)).toEqual([]);
  });
});
