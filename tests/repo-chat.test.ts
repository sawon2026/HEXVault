import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { MemoryEngine } from "../src/core/memory/engine.js";
import { repoChat } from "../src/core/ai/repo-chat.js";

describe("repoChat", () => {
  let dir: string;
  let engine: MemoryEngine;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hex-chat-"));
    engine = new MemoryEngine({ dbPath: path.join(dir, "t.db") });
  });

  afterEach(() => {
    engine.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("answers from memories with rule fallback", async () => {
    engine.add("Database choice", "We use SQLite for local storage", {
      type: "decision",
      tags: ["db"],
    });
    const res = await repoChat({
      engine,
      question: "What database do we use?",
    });
    expect(res.answer.length).toBeGreaterThan(10);
    expect(["llm", "rules"]).toContain(res.source);
    expect(res.sources.length).toBeGreaterThanOrEqual(0);
  });

  it("handles empty vault", async () => {
    const res = await repoChat({ engine, question: "anything?" });
    expect(res.answer).toMatch(/No matching|memory/i);
  });
});
