/**
 * Minimal GraphQL-compatible gateway (zero graphql package dependency).
 */
import type { MemoryEngine } from "../core/memory/engine.js";
import { repoChat } from "../core/ai/repo-chat.js";

export interface GqlRequest {
  query?: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface GqlResponse {
  data?: Record<string, unknown>;
  errors?: { message: string }[];
}

function field(query: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(query);
}

export async function executeGraphql(
  engine: MemoryEngine,
  body: GqlRequest
): Promise<GqlResponse> {
  const query = (body.query || "").trim();
  const vars = body.variables || {};
  if (!query) return { errors: [{ message: "query is required" }] };

  try {
    const data: Record<string, unknown> = {};

    if (field(query, "health")) {
      data.health = { ok: true, version: "2.1.0", service: "hexvault-graphql" };
    }

    if (field(query, "memories") && !field(query, "addMemory")) {
      const limit = Number(vars.limit ?? 20);
      data.memories = engine.list(limit).map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        content: m.content,
        tags: m.tags,
      }));
    }

    if (field(query, "search")) {
      const q = String(vars.q ?? vars.query ?? "");
      if (!q) return { errors: [{ message: "variable q is required for search" }] };
      const hits = engine.hybridSearch(q, Number(vars.limit ?? 10));
      data.search = {
        count: hits.length,
        results: hits.map((h) => ({
          id: h.entry.id,
          title: h.entry.title,
          type: h.entry.type,
          rankScore: h.rankScore,
          content: h.entry.content,
        })),
      };
    }

    if (field(query, "stats")) {
      data.stats = engine.stats();
    }

    if (/mutation/i.test(query) && field(query, "addMemory")) {
      const content = String(vars.content ?? "");
      if (!content) return { errors: [{ message: "content is required" }] };
      const entry = engine.add(String(vars.title ?? content.slice(0, 60)), content, {
        type: String(vars.type ?? "note") as never,
        tags: Array.isArray(vars.tags) ? vars.tags.map(String) : [],
        source: "graphql",
      });
      data.addMemory = { id: entry.id, title: entry.title, type: entry.type };
    }

    if (field(query, "chat")) {
      const question = String(vars.question ?? vars.q ?? "");
      if (!question) return { errors: [{ message: "question is required" }] };
      const result = await repoChat({ engine, question });
      data.chat = { answer: result.answer, source: result.source, sources: result.sources };
    }

    if (Object.keys(data).length === 0) {
      return {
        errors: [
          {
            message:
              "Unsupported selection. Supported: health, memories, search, stats, addMemory, chat",
          },
        ],
      };
    }
    return { data };
  } catch (err) {
    return { errors: [{ message: err instanceof Error ? err.message : String(err) }] };
  }
}

export const GRAPHQL_SCHEMA_SDL = `
type Health { ok: Boolean! version: String service: String }
type Memory { id: ID! title: String! type: String! content: String! tags: [String!] }
type SearchHit { id: ID! title: String! type: String! rankScore: Float content: String }
type SearchResult { count: Int! results: [SearchHit!]! }
type Stats { total: Int! byType: JSON }
type ChatResult { answer: String! source: String }
type Query {
  health: Health
  memories(limit: Int): [Memory!]
  search(q: String!, limit: Int): SearchResult
  stats: Stats
  chat(question: String!): ChatResult
}
type Mutation {
  addMemory(content: String!, title: String, type: String, tags: [String!]): Memory
  chat(question: String!): ChatResult
}
`;
