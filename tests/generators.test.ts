import { describe, it, expect } from "vitest";
import { generateCommitMessage, generateReleaseNotes } from "../src/core/ai/generators.js";

describe("AI generators (rule fallback)", () => {
  it("generates a commit message", async () => {
    const { message, source } = await generateCommitMessage({
      input: "Fixed race condition in auth middleware JWT expiry check",
    });
    expect(message.length).toBeGreaterThan(5);
    expect(["llm", "rules"]).toContain(source);
  });

  it("generates release notes", async () => {
    const { notes, source } = await generateReleaseNotes({
      version: "v1.2.0",
      items: ["Repo chat", "Commit message generator"],
    });
    expect(notes).toContain("1.2.0");
    expect(["llm", "rules"]).toContain(source);
  });
});
