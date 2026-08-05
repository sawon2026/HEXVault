/**
 * Memory summarization — condense long memories / conversations
 * for compact context windows. LLM-first with rule fallback.
 */
import { LLMRegistry } from "../llm/registry.js";
import { log } from "../logging/logger.js";

const logger = log.child("ai-summarize");

export interface SummarizeOptions {
  text: string;
  /** Target length in sentences */
  length?: "short" | "medium" | "long";
  maxLength?: number;
}

export interface SummaryResult {
  summary: string;
  source: "llm" | "rules";
}

function ruleSummarize(opts: SummarizeOptions): string {
  const sentences = opts.text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  const count = opts.length === "short" ? 2 : opts.length === "long" ? 8 : 4;
  const keep = sentences.slice(0, count);
  if (keep.length === 0) return opts.text.slice(0, 200);
  return keep.join(" ");
}

export async function summarize(
  opts: SummarizeOptions,
): Promise<SummaryResult> {
  const text = opts.text.slice(0, 12_000);
  const lengthLabel = opts.length || "medium";
  const registry = new LLMRegistry();

  try {
    const res = await registry.complete(
      [
        {
          role: "system",
          content: `You summarize technical text precisely. Preserve decisions, constraints, and gotchas. Output ${lengthLabel} summary (${lengthLabel === "short" ? "1-2" : lengthLabel === "long" ? "6-10" : "3-5"} sentences). No preamble.`,
        },
        { role: "user", content: text },
      ],
      { maxTokens: 300, temperature: 0.2 },
    );
    if (res.model !== "rule-based" && res.content.trim().length > 20) {
      const summary = res.content.trim();
      return {
        summary: opts.maxLength ? summary.slice(0, opts.maxLength) : summary,
        source: "llm",
      };
    }
  } catch (err) {
    logger.warn("Summarize LLM failed — rule fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { summary: ruleSummarize(opts), source: "rules" };
}
