import type { MemoryEntry } from "../memory/types.js";
import type { ReviewResult, ReviewOptions, ReviewComment } from "./types.js";

/**
 * Core Review Engine
 * In production this will call an LLM (OpenAI / Anthropic / Grok).
 * For now we provide a solid rule-based + template system that can be
 * easily upgraded to full AI later.
 */
export class ReviewEngine {
  private options: ReviewOptions;

  constructor(options: ReviewOptions = {}) {
    this.options = {
      model: options.model || "rule-based",
      severity: options.severity || "medium",
      checks: options.checks || ["security", "consistency", "best-practices"],
      maxMemories: options.maxMemories || 8,
    };
  }

  async review(
    prTitle: string,
    prBody: string,
    diff: string,
    relatedMemories: MemoryEntry[],
  ): Promise<ReviewResult> {
    const comments: ReviewComment[] = [];
    const securityIssues: string[] = [];
    const consistencyNotes: string[] = [];
    const usedMemories: string[] = [];

    // 1. Basic diff analysis
    const lines = diff.split("\n");
    const addedLines = lines.filter(
      (l) => l.startsWith("+") && !l.startsWith("+++"),
    );
    const removedLines = lines.filter(
      (l) => l.startsWith("-") && !l.startsWith("---"),
    );

    // Security heuristics
    if (this.options.checks?.includes("security")) {
      const securityPatterns = [
        {
          pattern: /password\s*=\s*['"][^'"]+['"]/i,
          msg: "Hardcoded password detected",
        },
        {
          pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
          msg: "Hardcoded API key detected",
        },
        {
          pattern: /secret\s*=\s*['"][^'"]+['"]/i,
          msg: "Possible hardcoded secret",
        },
        { pattern: /eval\s*\(/i, msg: "Use of eval() is dangerous" },
        { pattern: /innerHTML\s*=/i, msg: "innerHTML usage can lead to XSS" },
        {
          pattern: /dangerouslySetInnerHTML/i,
          msg: "dangerouslySetInnerHTML detected",
        },
      ];

      for (const line of addedLines) {
        for (const { pattern, msg } of securityPatterns) {
          if (pattern.test(line)) {
            securityIssues.push(msg);
            comments.push({
              body: `🔒 **Security**: ${msg}`,
              severity: "error",
            });
          }
        }
      }
    }

    // Consistency with memories
    if (
      this.options.checks?.includes("consistency") &&
      relatedMemories.length > 0
    ) {
      for (const mem of relatedMemories.slice(0, this.options.maxMemories)) {
        usedMemories.push(mem.title);

        if (mem.type === "decision" || mem.type === "architecture") {
          consistencyNotes.push(
            `Related past decision: "${mem.title}" — ${mem.content.slice(0, 120)}...`,
          );
        }

        if (mem.type === "security") {
          comments.push({
            body: `🛡️ **Past Security Note**: ${mem.title}\n\n${mem.content.slice(0, 200)}`,
            severity: "warning",
          });
        }

        if (mem.type === "bugfix") {
          comments.push({
            body: `🐛 **Related Bug Fix**: ${mem.title}\n\nMake sure this change doesn't reintroduce the issue.`,
            severity: "suggestion",
          });
        }
      }
    }

    // Best practices
    if (this.options.checks?.includes("best-practices")) {
      if (addedLines.length > 300) {
        comments.push({
          body: "📦 This PR is quite large. Consider splitting into smaller PRs for easier review.",
          severity: "suggestion",
        });
      }

      if (!prBody || prBody.trim().length < 20) {
        comments.push({
          body: "📝 Please add a meaningful description to the PR body.",
          severity: "info",
        });
      }
    }

    // Build summary
    const summaryParts: string[] = [];
    summaryParts.push(`**HEXVault Review** for: *${prTitle}*`);
    summaryParts.push("");
    summaryParts.push(`- Lines added: ${addedLines.length}`);
    summaryParts.push(`- Lines removed: ${removedLines.length}`);
    summaryParts.push(`- Related memories used: ${usedMemories.length}`);

    if (securityIssues.length > 0) {
      summaryParts.push(`- ⚠️ Security issues found: ${securityIssues.length}`);
    } else {
      summaryParts.push("- ✅ No obvious security issues detected");
    }

    if (consistencyNotes.length > 0) {
      summaryParts.push("");
      summaryParts.push("### Consistency with Project Memory");
      consistencyNotes.forEach((n) => summaryParts.push(`- ${n}`));
    }

    // Score
    let score = 85;
    score -= securityIssues.length * 15;
    score -= comments.filter((c) => c.severity === "error").length * 10;
    score = Math.max(0, Math.min(100, score));

    return {
      summary: summaryParts.join("\n"),
      comments,
      securityIssues,
      consistencyNotes,
      score,
      usedMemories,
    };
  }
}
