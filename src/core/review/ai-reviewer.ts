/**
 * AI-powered Review Engine (uses LLM when available)
 */
import type { MemoryEntry } from "../memory/types.js";
import type { ReviewResult, ReviewOptions, ReviewComment } from "./types.js";
import { ReviewEngine } from "./reviewer.js";
import { createLLMProvider, type LLMProvider } from "../llm/provider.js";

export class AIReviewEngine extends ReviewEngine {
  private llm: LLMProvider;

  constructor(options: ReviewOptions = {}, llm?: LLMProvider) {
    super(options);
    this.llm =
      llm ||
      createLLMProvider(
        (options.model as any) || "rule-based",
        process.env.HEXVAULT_API_KEY,
      );
  }

  async review(
    prTitle: string,
    prBody: string,
    diff: string,
    relatedMemories: MemoryEntry[],
  ): Promise<ReviewResult> {
    // Always run rule-based first for security heuristics
    const base = await super.review(prTitle, prBody, diff, relatedMemories);

    if (this.llm.name === "rule-based") {
      return base;
    }

    try {
      const memoryContext = relatedMemories
        .slice(0, 8)
        .map((m) => `[${m.type}] ${m.title}: ${m.content.slice(0, 200)}`)
        .join("\n");

      const prompt = `You are HEXVault, an expert code reviewer that knows this project's history.

## Project Memories
${memoryContext || "(no related memories)"}

## PR
Title: ${prTitle}
Body: ${prBody || "(none)"}

## Diff (truncated)
${diff.slice(0, 6000)}

Respond in this exact JSON format:
{
  "summary": "2-4 sentence review summary",
  "score": 0-100,
  "comments": [
    { "severity": "error|warning|suggestion|info", "body": "comment text" }
  ],
  "securityIssues": ["..."],
  "consistencyNotes": ["..."]
}`;

      const res = await this.llm.complete([
        {
          role: "system",
          content:
            "You are a precise senior engineer. Output only valid JSON. Be concise and actionable.",
        },
        { role: "user", content: prompt },
      ]);

      const parsed = this.safeParse(res.content);
      if (!parsed) return base;

      // Merge: keep rule-based security findings, enhance with AI
      const comments: ReviewComment[] = [
        ...base.comments,
        ...(parsed.comments || []).map((c: any) => ({
          body: c.body,
          severity: c.severity || "suggestion",
        })),
      ];

      return {
        summary: parsed.summary || base.summary,
        comments,
        securityIssues: [
          ...new Set([
            ...base.securityIssues,
            ...(parsed.securityIssues || []),
          ]),
        ],
        consistencyNotes: [
          ...new Set([
            ...base.consistencyNotes,
            ...(parsed.consistencyNotes || []),
          ]),
        ],
        score: typeof parsed.score === "number" ? parsed.score : base.score,
        usedMemories: base.usedMemories,
      };
    } catch {
      // fallback to rule-based
      return base;
    }
  }

  private safeParse(text: string): any {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
