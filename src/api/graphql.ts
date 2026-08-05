/**
 * Minimal GraphQL-compatible gateway (zero graphql package dependency).
 * Supports a fixed schema via POST body: { query, variables, operationName }
 *
 * Supported operations:
 *   query { health { ok version } }
 *   query { memories(limit: Int) { id title type content tags } }
 *   query { search(q: String!, limit: Int) { count results { id title type rankScore content } } }
 *   query { stats { total byType } }
 *   query { timeline { items { date count types } } }
 *   query { tags { tags { tag count } } }
 *   mutation { addMemory(content: String!, title: String, type: String, tags: [String]) { id title } }
 *   mutation { updateMemory(id: ID!, title: String, content: String) { id title } }
 *   mutation { deleteMemory(id: ID!) { ok } }
 *   mutation { chat(question: String!) { answer source } }
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
  body: GqlRequest,
): Promise<GqlResponse> {
  const query = (body.query || "").trim();
  const vars = body.variables || {};

  if (!query) {
    return { errors: [{ message: "query is required" }] };
  }

  try {
    const data: Record<string, unknown> = {};

    // health
    if (field(query, "health")) {
      data.health = { ok: true, version: "3.0.0", service: "hexvault-graphql" };
    }

    // memories
    if (field(query, "memories") && !field(query, "addMemory")) {
      const limit = Number(vars.limit ?? 20);
      const items = engine.list(limit).map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        content: m.content,
        tags: m.tags,
        importance: m.importance,
        category: m.category ?? null,
        createdAt: m.createdAt,
      }));
      data.memories = items;
    }

    // search
    if (field(query, "search")) {
      const q = String(vars.q ?? vars.query ?? "");
      if (!q)
        return { errors: [{ message: "variable q is required for search" }] };
      const limit = Number(vars.limit ?? 10);
      const hits = engine.hybridSearch(q, limit);
      data.search = {
        count: hits.length,
        results: hits.map((h) => ({
          id: h.entry.id,
          title: h.entry.title,
          type: h.entry.type,
          rankScore: h.rankScore,
          importance: h.importance,
          content: h.entry.content,
        })),
      };
    }

    // stats
    if (field(query, "stats")) {
      data.stats = engine.stats();
    }

    // timeline
    if (field(query, "timeline")) {
      data.timeline = { items: engine.timeline(Number(vars.limit ?? 200)) };
    }

    // tags
    if (field(query, "tags")) {
      data.tags = { tags: engine.tagStats(Number(vars.limit ?? 100)) };
    }

    // health/memory
    if (field(query, "memoryHealth")) {
      data.memoryHealth = engine.health();
    }

    // addMemory mutation
    if (/mutation/i.test(query) && field(query, "addMemory")) {
      const content = String(vars.content ?? "");
      if (!content) return { errors: [{ message: "content is required" }] };
      const title = String(vars.title ?? content.slice(0, 60));
      const type = String(vars.type ?? "note");
      const tags = Array.isArray(vars.tags) ? vars.tags.map(String) : [];
      const entry = engine.add(title, content, {
        type: type as never,
        tags,
        source: "graphql",
        autoTag: false,
      });
      data.addMemory = {
        id: entry.id,
        title: entry.title,
        type: entry.type,
      };
    }

    // updateMemory mutation
    if (/mutation/i.test(query) && field(query, "updateMemory")) {
      const id = String(vars.id ?? "");
      if (!id) return { errors: [{ message: "id is required" }] };
      const updated = engine.update(id, {
        title: vars.title !== undefined ? String(vars.title) : undefined,
        content: vars.content !== undefined ? String(vars.content) : undefined,
      });
      if (!updated) return { errors: [{ message: "memory not found" }] };
      data.updateMemory = {
        id: updated.id,
        title: updated.title,
        type: updated.type,
      };
    }

    // deleteMemory mutation
    if (/mutation/i.test(query) && field(query, "deleteMemory")) {
      const id = String(vars.id ?? "");
      if (!id) return { errors: [{ message: "id is required" }] };
      data.deleteMemory = { ok: engine.delete(id) };
    }

    // chat mutation / query
    if (field(query, "chat")) {
      const question = String(vars.question ?? vars.q ?? "");
      if (!question) return { errors: [{ message: "question is required" }] };
      const result = await repoChat({ engine, question });
      data.chat = {
        answer: result.answer,
        source: result.source,
        sources: result.sources,
      };
    }

    if (Object.keys(data).length === 0) {
      return {
        errors: [
          {
            message:
              "Unsupported or empty selection. Supported: health, memories, search, stats, timeline, tags, memoryHealth, addMemory, updateMemory, deleteMemory, chat",
          },
        ],
      };
    }

    return { data };
  } catch (err) {
    return {
      errors: [{ message: err instanceof Error ? err.message : String(err) }],
    };
  }
}

/** Introspection-lite schema description for clients */
export const GRAPHQL_SCHEMA_SDL = `
type Health { ok: Boolean! version: String service: String }
type Memory { id: ID! title: String! type: String! content: String! tags: [String!] importance: Float category: String createdAt: String }
type SearchHit { id: ID! title: String! type: String! rankScore: Float importance: Float content: String }
type SearchResult { count: Int! results: [SearchHit!]! }
type Stats { total: Int! byType: JSON }
type TimelineItem { date: String! count: Int! types: JSON }
type TimelineResult { items: [TimelineItem!]! }
type TagCount { tag: String! count: Int! }
type TagResult { tags: [TagCount!]! }
type MemoryHealth { ok: Boolean! total: Int! expiredCount: Int! staleCount: Int! importanceAvg: Float warnings: [String!] recommendations: [String!] }
type ChatResult { answer: String! source: String sources: [SearchHit!] }
type DeleteResult { ok: Boolean! }
type Query {
  health: Health
  memories(limit: Int): [Memory!]
  search(q: String!, limit: Int): SearchResult
  stats: Stats
  timeline(limit: Int): TimelineResult
  tags(limit: Int): TagResult
  memoryHealth: MemoryHealth
  chat(question: String!): ChatResult
}
type Mutation {
  addMemory(content: String!, title: String, type: String, tags: [String!]): Memory
  updateMemory(id: ID!, title: String, content: String): Memory
  deleteMemory(id: ID!): DeleteResult
  chat(question: String!): ChatResult
}
`;
