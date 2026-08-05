/**
 * Repo chat — RAG over project memories (+ optional extra context).
 */
import { MemoryEngine } from "../memory/engine.js";
import { LLMRegistry } from "../llm/registry.js";
import type { LLMMessage } from "../llm/provider.js";
import { log } from "../logging/logger.js";

const logger = log.child("repo-chat");

export interface ChatOptions {
  engine: MemoryEngine;
  question: string;
  /** Extra context (file snippets, etc.) */
  extraContext?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface ChatResult {
  answer: string;
  sources: { id: string; title: string; type: string; rankScore: number }[];
  source: "llm" | "rules";
}

function ruleAnswer(
  question: string,
  memories: { title: string; content: string; type: string }[],
): string {
  if (!memories.length) {
    return (
      `No matching project memories for: "${question}"\n\n` +
      `Tip: add memories with \`hexvault add "..." --type decision\` then ask again.`
    );
  }
  const lines = memories
    .slice(0, 5)
    .map(
      (m, i) =>
        `${i + 1}. [${m.type}] ${m.title}\n   ${m.content.slice(0, 200)}`,
    );
  return (
    `Based on ${memories.length} project memory(ies):\n\n` +
    lines.join("\n\n") +
    `\n\n(Rule-based answer — set HEXVAULT_LLM_PRIORITY / API keys for richer LLM replies.)`
  );
}

export async function repoChat(opts: ChatOptions): Promise<ChatResult> {
  const q = opts.question.trim();
  const hits = opts.engine.hybridSearch(q, 8);
  const sources = hits.map((h) => ({
    id: h.entry.id,
    title: h.entry.title,
    type: h.entry.type,
    rankScore: h.rankScore,
  }));

  const memoryBlock = hits
    .map(
      (h, i) =>
        `[${i + 1}] (${h.entry.type}) ${h.entry.title}\n${h.entry.content}\nTags: ${h.entry.tags.join(", ") || "—"}`,
    )
    .join("\n\n");

  const registry = new LLMRegistry();
  const messages: LLMMessage[] = [
    {
      role: "system",
      content:
        "You are HEXVault, a project-memory assistant. Answer using the provided project memories. Cite memory numbers like [1]. If memories are insufficient, say so and suggest what to store. Be concise and practical.",
    },
  ];

  if (opts.history?.length) {
    for (const h of opts.history.slice(-6)) {
      messages.push({ role: h.role, content: h.content });
    }
  }

  messages.push({
    role: "user",
    content:
      `Project memories:\n\n${memoryBlock || "(none)"}\n\n` +
      (opts.extraContext
        ? `Extra context:\n${opts.extraContext.slice(0, 3000)}\n\n`
        : "") +
      `Question: ${q}`,
  });

  try {
    const res = await registry.complete(messages, {
      maxTokens: 600,
      temperature: 0.3,
    });
    if (res.model !== "rule-based" && res.content.trim().length > 10) {
      return { answer: res.content.trim(), sources, source: "llm" };
    }
  } catch (err) {
    logger.warn("Repo chat LLM failed — rule fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    answer: ruleAnswer(
      q,
      hits.map((h) => ({
        title: h.entry.title,
        content: h.entry.content,
        type: h.entry.type,
      })),
    ),
    sources,
    source: "rules",
  };
}
