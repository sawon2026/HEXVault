import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { MemoryEngine } from "../src/core/memory/engine.js";

describe("MemoryEngine v3 features", () => {
  let dir: string;
  let engine: MemoryEngine;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hexvault-v3-"));
    engine = new MemoryEngine({ dbPath: path.join(dir, "test.db") });
  });

  afterEach(() => {
    engine.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("persists importance from type and explicit option", () => {
    const e = engine.add("Security rule", "Always hash secrets", {
      type: "security",
    });
    expect(e.importance).toBeGreaterThanOrEqual(0.8);
    const explicit = engine.add("Explicit", "Custom importance", {
      type: "note",
      importance: 0.4,
    });
    expect(explicit.importance).toBeCloseTo(0.4, 5);
    const stored = engine.get(explicit.id);
    expect(stored?.importance).toBeCloseTo(0.4, 5);
  });

  it("purges expired memories via purgeExpired", () => {
    const e = engine.add("Temp note", "Short lived", {
      ttlDays: 0.0001,
      type: "note",
    });
    expect(engine.get(e.id)).not.toBeNull();
    const removed = engine.purgeExpired(Date.now() + 60_000);
    expect(removed).toContain(e.id);
    expect(engine.get(e.id)).toBeNull();
  });

  it("setTtl applies a time-to-live retroactively", () => {
    const e = engine.add("TTL later", "content", { type: "note" });
    const updated = engine.setTtl(e.id, 0.0001);
    expect(updated?.ttlExpires).toBeDefined();
    engine.purgeExpired(Date.now() + 60_000);
    expect(engine.get(e.id)).toBeNull();
  });

  it("links memories and lists by link", () => {
    const a = engine.add("Decision A", "content a", { type: "decision" });
    const b = engine.add("Decision B", "content b", { type: "decision" });
    engine.linkMemory(a.id, {
      kind: "repository",
      id: "repo-1",
      label: "hexvault",
    });
    engine.linkMemory(a.id, {
      kind: "issue",
      id: "issue-42",
      label: "link pr",
    });
    engine.linkMemory(b.id, {
      kind: "repository",
      id: "repo-1",
      label: "hexvault",
    });
    const repo = engine.listByLink("repository", "repo-1");
    expect(repo.map((m) => m.id).sort()).toEqual([a.id, b.id].sort());
    const issue = engine.listByLink("issue", "issue-42");
    expect(issue.length).toBe(1);
    expect(issue[0].id).toBe(a.id);
  });

  it("records conversations as conversation-typed memories", () => {
    const conv = engine.recordConversation({
      conversationId: "conv-1",
      question: "Which database?",
      answer: "Use sqlite",
    });
    expect(conv).not.toBeNull();
    expect(conv?.type).toBe("conversation");
    expect(conv?.importance).toBeLessThan(0.5);
    const list = engine.listByLink("conversation", "conv-1");
    expect(list.length).toBeGreaterThanOrEqual(1);
  });

  it("auto-tags when autoTag enabled", () => {
    const e = engine.add(
      "JWT session handling",
      "Middleware validates session tokens",
      { type: "security", autoTag: true },
    );
    expect(e.tags.length).toBeGreaterThan(0);
    const none = engine.add("No tags please", "content", {
      type: "note",
      autoTag: false,
    });
    expect(none.tags.length).toBe(0);
  });

  it("timeline groups by day with type breakdown", () => {
    engine.add("T1", "x", { type: "decision" });
    engine.add("T2", "y", { type: "bugfix" });
    const tl = engine.timeline();
    expect(tl.length).toBeGreaterThanOrEqual(1);
    const today = tl[0];
    expect(today.count).toBeGreaterThanOrEqual(2);
    expect(today.types).toBeDefined();
  });

  it("health report reflects warnings and totals", () => {
    engine.add("Mem", "content", { type: "note" });
    const h = engine.health();
    expect(h.total).toBeGreaterThanOrEqual(1);
    expect(typeof h.importanceAvg).toBe("number");
    expect(Array.isArray(h.warnings)).toBe(true);
    expect(Array.isArray(h.recommendations)).toBe(true);
  });

  it("findDuplicate reuses existing memory id", () => {
    const first = engine.add("Dup title", "Same body 12345", { type: "note" });
    const dup = engine.findDuplicate("Dup title", "Same body 12345");
    expect(dup?.id).toBe(first.id);
  });
});
