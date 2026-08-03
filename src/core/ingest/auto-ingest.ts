/**
 * Auto-ingest from PRs, commits, and issues
 */
import type { MemoryStore } from "../memory/store.js";
import type { MemoryType } from "../memory/types.js";
import { createLLMProvider, type LLMProvider } from "../llm/provider.js";

export interface PRIngestPayload {
  number: number;
  title: string;
  body: string;
  merged: boolean;
  files: string[];
  author?: string;
}

export interface CommitIngestPayload {
  sha: string;
  message: string;
  files: string[];
  author?: string;
}

export class AutoIngest {
  private store: MemoryStore;
  private llm: LLMProvider;

  constructor(store: MemoryStore, llmProvider?: LLMProvider) {
    this.store = store;
    this.llm = llmProvider || createLLMProvider("rule-based");
  }

  /** Ingest a merged PR into memory */
  async ingestPR(pr: PRIngestPayload): Promise<string | null> {
    if (!pr.merged) return null;

    const summary = await this.summarize(
      `Pull Request #${pr.number}: ${pr.title}\n\n${pr.body || ""}\n\nFiles: ${pr.files.join(", ")}`
    );

    const type = this.detectType(pr.title + " " + (pr.body || ""));
    const entry = this.store.add(pr.title, summary, {
      type,
      files: pr.files,
      tags: ["auto-ingest", "pr", `pr-${pr.number}`],
      source: `PR #${pr.number}`,
    });

    return entry.id;
  }

  /** Ingest a meaningful commit */
  async ingestCommit(commit: CommitIngestPayload): Promise<string | null> {
    // Skip trivial commits
    const msg = commit.message.toLowerCase();
    if (
      msg.startsWith("merge") ||
      msg.startsWith("chore:") ||
      msg.startsWith("style:") ||
      msg.length < 15
    ) {
      return null;
    }

    const type = this.detectType(commit.message);
    const entry = this.store.add(commit.message.split("\n")[0].slice(0, 80), commit.message, {
      type,
      files: commit.files,
      tags: ["auto-ingest", "commit"],
      source: `commit ${commit.sha.slice(0, 7)}`,
    });

    return entry.id;
  }

  private detectType(text: string): MemoryType {
    const t = text.toLowerCase();
    if (t.includes("fix") || t.includes("bug") || t.includes("hotfix")) return "bugfix";
    if (t.includes("security") || t.includes("cve") || t.includes("xss") || t.includes("inject"))
      return "security";
    if (t.includes("refactor") || t.includes("cleanup")) return "refactor";
    if (t.includes("api") || t.includes("endpoint")) return "api";
    if (t.includes("architect") || t.includes("design") || t.includes("decision"))
      return "architecture";
    if (t.includes("pattern") || t.includes("convention")) return "pattern";
    return "note";
  }

  private async summarize(text: string): Promise<string> {
    if (this.llm.name === "rule-based") {
      // simple truncation
      return text.slice(0, 500) + (text.length > 500 ? "..." : "");
    }

    try {
      const res = await this.llm.complete([
        {
          role: "system",
          content:
            "Summarize this pull request or change into 2-4 concise sentences focusing on decisions, fixes, and important patterns. No fluff.",
        },
        { role: "user", content: text },
      ]);
      return res.content.trim();
    } catch {
      return text.slice(0, 500);
    }
  }
}
