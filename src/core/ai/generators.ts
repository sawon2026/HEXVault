/**
 * AI generators — commit messages & release notes.
 * Uses LLMRegistry with rule-based fallback when no API key.
 */
import { LLMRegistry } from "../llm/registry.js";
import type { LLMMessage } from "../llm/provider.js";
import { log } from "../logging/logger.js";

const logger = log.child("ai-generators");

function ruleCommitMessage(diffOrSummary: string): string {
  const lower = diffOrSummary.toLowerCase();
  let type = "chore";
  if (/\bfix|bug|patch|error\b/.test(lower)) type = "fix";
  else if (/\bfeat|add|new|implement\b/.test(lower)) type = "feat";
  else if (/\bdoc|readme\b/.test(lower)) type = "docs";
  else if (/\btest|spec\b/.test(lower)) type = "test";
  else if (/\brefactor\b/.test(lower)) type = "refactor";
  else if (/\bsecur|auth|jwt\b/.test(lower)) type = "fix";

  const first = diffOrSummary
    .split(/\n/)
    .map((l) => l.replace(/^[+\-\s]*/, "").trim())
    .find((l) => l.length > 8 && !l.startsWith("@@") && !l.startsWith("diff"));
  const subject = (first || "update project files").slice(0, 72).replace(/\.$/, "");
  return `${type}: ${subject.charAt(0).toLowerCase()}${subject.slice(1)}`;
}

function ruleReleaseNotes(version: string, items: string[]): string {
  const body = items.length
    ? items.map((i) => `- ${i}`).join("\n")
    : "- Maintenance and internal improvements";
  return `## ${version}\n\n### Changes\n\n${body}\n`;
}

export interface CommitMessageOptions {
  input: string;
  conventional?: boolean;
}

export async function generateCommitMessage(
  opts: CommitMessageOptions
): Promise<{ message: string; source: "llm" | "rules" }> {
  const input = opts.input.slice(0, 6000);
  const registry = new LLMRegistry();

  const messages: LLMMessage[] = [
    {
      role: "system",
      content:
        "You write concise git commit messages. Prefer Conventional Commits (feat/fix/docs/refactor/test/chore). One line subject max 72 chars. No quotes. No explanation.",
    },
    {
      role: "user",
      content: `Write a commit message for these changes:\n\n${input}`,
    },
  ];

  try {
    const res = await registry.complete(messages, { maxTokens: 80, temperature: 0.3 });
    const msg = res.content.trim().split("\n")[0].replace(/^["']|["']$/g, "");
    if (msg.length > 5) {
      return { message: msg.slice(0, 100), source: "llm" };
    }
  } catch (err) {
    logger.warn("Commit LLM failed — rule fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { message: ruleCommitMessage(input), source: "rules" };
}

export interface ReleaseNotesOptions {
  version: string;
  items: string[];
  projectName?: string;
}

export async function generateReleaseNotes(
  opts: ReleaseNotesOptions
): Promise<{ notes: string; source: "llm" | "rules" }> {
  const items = opts.items.slice(0, 40);
  const registry = new LLMRegistry();

  const messages: LLMMessage[] = [
    {
      role: "system",
      content:
        "You write clear GitHub release notes in Markdown. Group into Added / Fixed / Changed when possible. Be concise. No fluff.",
    },
    {
      role: "user",
      content: `Project: ${opts.projectName || "HEXVault"}\nVersion: ${opts.version}\n\nChanges:\n${items.map((i) => `- ${i}`).join("\n")}\n\nWrite release notes.`,
    },
  ];

  try {
    const res = await registry.complete(messages, { maxTokens: 800, temperature: 0.4 });
    if (res.content.trim().length > 20) {
      return { notes: res.content.trim(), source: "llm" };
    }
  } catch (err) {
    logger.warn("Release notes LLM failed — rule fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { notes: ruleReleaseNotes(opts.version, items), source: "rules" };
}
