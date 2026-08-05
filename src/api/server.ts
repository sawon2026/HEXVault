/**
 * HEXVault REST + GraphQL API v3.0.0
 *
 * Endpoints (see docs/api/REST.md for the full reference):
 *  GET/POST    /v1/memories            list / create
 *  GET/PATCH/DELETE /v1/memories/:id   read / update / delete
 *  GET         /v1/search?q=           hybrid search
 *  GET         /v1/stats               memory stats
 *  GET         /v1/analytics           dashboard analytics
 *  GET         /v1/timeline            memories grouped by day
 *  GET         /v1/tags                tag cloud
 *  GET         /v1/health              health + version + providers
 *  GET         /v1/graph               knowledge graph (force-laid-out)
 *  POST        /graphql                GraphQL subset
 *  GET/POST    /v1/sync/export|import   bundle sync
 *  GET         /v1/multi-repo/search   cross-repo keyword search
 *  GET         /v1/analyze             complexity + dead-code heuristics
 *  POST        /v1/review              context-aware PR review
 *  POST        /v1/chat                RAG repo chat (conversation aware)
 *  POST        /v1/commit-message      commit message generator
 *  POST        /v1/release-notes       release notes generator
 *  POST        /v1/changelog           changelog generator
 *  POST        /v1/explain             code explanation
 *  POST        /v1/deps                dependency analysis
 *  POST        /v1/webhook/test        test webhook delivery
 */
import http from "http";
import { URL } from "url";
import path from "path";
import { MemoryEngine } from "../core/memory/engine.js";
import type { MemoryType } from "../core/memory/types.js";
import { loadConfig } from "../config/index.js";
import { log } from "../core/logging/logger.js";
import { AppError, isAppError } from "../core/errors/app-error.js";
import {
  generateCommitMessage,
  generateReleaseNotes,
} from "../core/ai/generators.js";
import { generateChangelog, explainCode } from "../core/ai/features.js";
import { repoChat } from "../core/ai/repo-chat.js";
import { analyzeProject } from "../core/analysis/heuristics.js";
import { buildKnowledgeGraph, layoutGraph } from "../core/graph/builder.js";
import { executeGraphql, GRAPHQL_SCHEMA_SDL } from "./graphql.js";
import { MultiRepoLinker } from "../core/multi-repo/linker.js";
import {
  exportBundle,
  importBundle,
  parseBundle,
} from "../core/sync/exchange.js";
import { publishWebhook, endpointsFromEnv } from "../core/webhooks/emitter.js";
import { LLMRegistry } from "../core/llm/registry.js";
import { analyzeDependencyReport } from "../core/ai/features.js";

const logger = log.child("api");
const VERSION = "3.0.0";
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MiB

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(
          new AppError("CONFIG_INVALID", "Request body too large", {
            statusCode: 413,
          }),
        );
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function checkAuth(req: http.IncomingMessage): void {
  const token = process.env.HEXVAULT_API_TOKEN;
  if (!token) return;
  const header = req.headers.authorization || "";
  const value = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (value !== token) {
    throw new AppError("PROVIDER_AUTH", "Invalid or missing API token", {
      statusCode: 401,
    });
  }
}

export interface ApiServerOptions {
  port?: number;
  host?: string;
  cwd?: string;
}

export function createApiServer(opts: ApiServerOptions = {}) {
  const port = opts.port ?? Number(process.env.HEXVAULT_API_PORT || 3850);
  const host = opts.host ?? process.env.HEXVAULT_API_HOST ?? "127.0.0.1";
  const cwd = opts.cwd ?? process.cwd();
  const config = loadConfig(cwd);
  const dbPath = path.isAbsolute(config.memory.path)
    ? config.memory.path
    : path.join(cwd, config.memory.path);
  const engine = new MemoryEngine({
    dbPath,
    defaultTtlDays: config.memory.defaultTtlDays,
    dedupThreshold: config.memory.dedupThreshold,
  });

  const webhookEndpoints = config.webhooks.enabled ? endpointsFromEnv() : [];

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }
    try {
      checkAuth(req);
      const url = new URL(req.url || "/", `http://${host}:${port}`);
      const p = url.pathname.replace(/\/$/, "") || "/";

      /* ── Health ──────────────────────────────────────── */
      if (req.method === "GET" && (p === "/health" || p === "/v1/health")) {
        const registry = new LLMRegistry();
        json(res, 200, {
          ok: true,
          service: "hexvault-api",
          version: VERSION,
          uptimeSec: Math.round(process.uptime()),
          node: process.version,
          providers: registry.status(),
          webhooks: webhookEndpoints.length,
        });
        return;
      }

      /* ── Memories ────────────────────────────────────── */
      if (req.method === "GET" && p === "/v1/memories") {
        const limit = Math.min(
          Number(url.searchParams.get("limit") || 50),
          1000,
        );
        const typeParam = url.searchParams.get("type");
        const items = engine.list(
          limit,
          typeParam ? (typeParam as MemoryType) : undefined,
        );
        json(res, 200, { count: items.length, items });
        return;
      }

      const memMatch = p.match(/^\/v1\/memories\/([^/]+)$/);
      if (req.method === "GET" && memMatch) {
        const item = engine.get(memMatch[1]);
        if (!item)
          throw new AppError("MEMORY_NOT_FOUND", "Memory not found", {
            statusCode: 404,
          });
        json(res, 200, item);
        return;
      }
      if (req.method === "PATCH" && memMatch) {
        const body = JSON.parse((await readBody(req)) || "{}");
        const updated = engine.update(memMatch[1], {
          title: body.title !== undefined ? String(body.title) : undefined,
          content:
            body.content !== undefined ? String(body.content) : undefined,
          type:
            body.type !== undefined
              ? (String(body.type) as MemoryType)
              : undefined,
          tags:
            body.tags !== undefined
              ? Array.isArray(body.tags)
                ? body.tags.map(String)
                : []
              : undefined,
          files:
            body.files !== undefined
              ? Array.isArray(body.files)
                ? body.files.map(String)
                : []
              : undefined,
          category:
            body.category !== undefined ? String(body.category) : undefined,
          importance:
            body.importance !== undefined ? Number(body.importance) : undefined,
        });
        if (!updated)
          throw new AppError("MEMORY_NOT_FOUND", "Memory not found", {
            statusCode: 404,
          });
        void publishWebhook(
          "memory.updated",
          { id: updated.id, title: updated.title },
          webhookEndpoints,
        );
        json(res, 200, updated);
        return;
      }
      if (req.method === "DELETE" && memMatch) {
        const existed = engine.delete(memMatch[1]);
        if (!existed)
          throw new AppError("MEMORY_NOT_FOUND", "Memory not found", {
            statusCode: 404,
          });
        void publishWebhook(
          "memory.deleted",
          { id: memMatch[1] },
          webhookEndpoints,
        );
        json(res, 200, { ok: true, deleted: memMatch[1] });
        return;
      }
      if (req.method === "POST" && p === "/v1/memories") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const content = String(body.content || body.title || "");
        if (!content)
          throw new AppError("CONFIG_INVALID", "content is required", {
            statusCode: 400,
          });
        const entry = engine.add(
          String(body.title || content).slice(0, 200),
          content,
          {
            type: (body.type || "note") as MemoryType,
            tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
            files: Array.isArray(body.files) ? body.files.map(String) : [],
            source: body.source ? String(body.source) : "api",
            category: body.category ? String(body.category) : undefined,
            importance:
              body.importance !== undefined
                ? Number(body.importance)
                : undefined,
            ttlDays:
              body.ttlDays !== undefined ? Number(body.ttlDays) : undefined,
            autoTag: body.autoTag !== false,
          },
        );
        void publishWebhook(
          "memory.added",
          { id: entry.id, title: entry.title, type: entry.type },
          webhookEndpoints,
        );
        json(res, 201, entry);
        return;
      }

      /* ── Search ──────────────────────────────────────── */
      if (req.method === "GET" && p === "/v1/search") {
        const q =
          url.searchParams.get("q") || url.searchParams.get("query") || "";
        if (!q)
          throw new AppError("CONFIG_INVALID", "q is required", {
            statusCode: 400,
          });
        const hits = engine.hybridSearch(
          q,
          Number(url.searchParams.get("limit") || 10),
        );
        json(res, 200, {
          query: q,
          count: hits.length,
          results: hits.map((h) => ({
            id: h.entry.id,
            title: h.entry.title,
            type: h.entry.type,
            score: h.score,
            rankScore: h.rankScore,
            importance: h.importance,
            reasons: h.reasons,
            content: h.entry.content,
          })),
        });
        return;
      }

      /* ── Stats / analytics / timeline / tags ─────────── */
      if (req.method === "GET" && p === "/v1/stats") {
        json(res, 200, engine.stats());
        return;
      }
      if (req.method === "GET" && p === "/v1/analytics") {
        json(res, 200, engine.analytics());
        return;
      }
      if (req.method === "GET" && p === "/v1/timeline") {
        json(res, 200, {
          items: engine.timeline(Number(url.searchParams.get("limit") || 200)),
        });
        return;
      }
      if (req.method === "GET" && p === "/v1/tags") {
        json(res, 200, {
          tags: engine.tagStats(Number(url.searchParams.get("limit") || 100)),
        });
        return;
      }
      if (req.method === "GET" && p === "/v1/health/memory") {
        json(res, 200, engine.health());
        return;
      }

      /* ── Knowledge graph ─────────────────────────────── */
      if (req.method === "GET" && p === "/v1/graph") {
        const limit = Math.min(
          Number(url.searchParams.get("limit") || 60),
          300,
        );
        const memories = engine.list(limit);
        const graph = buildKnowledgeGraph(memories, { maxMemories: limit });
        const laid = layoutGraph(
          graph,
          Number(url.searchParams.get("w") || 900),
          Number(url.searchParams.get("h") || 600),
        );
        json(res, 200, { ...laid, stats: graph.stats });
        return;
      }

      /* ── GraphQL ─────────────────────────────────────── */
      if (
        (req.method === "POST" || req.method === "GET") &&
        (p === "/graphql" || p === "/v1/graphql")
      ) {
        if (req.method === "GET") {
          json(res, 200, {
            schema: GRAPHQL_SCHEMA_SDL,
            note: "POST { query, variables } to execute",
          });
          return;
        }
        const body = JSON.parse((await readBody(req)) || "{}");
        json(res, 200, await executeGraphql(engine, body));
        return;
      }

      /* ── Multi-repo ───────────────────────────────────── */
      if (req.method === "GET" && p === "/v1/multi-repo/search") {
        const q = url.searchParams.get("q") || "";
        if (!q)
          throw new AppError("CONFIG_INVALID", "q is required", {
            statusCode: 400,
          });
        const linker = new MultiRepoLinker();
        linker.loadFromConfig(path.join(cwd, ".hexvault", "multi-repo.json"));
        const hits = linker.searchAll(
          q,
          Number(url.searchParams.get("limit") || 15),
        );
        linker.close();
        json(res, 200, {
          query: q,
          count: hits.length,
          results: hits.map((h) => ({
            repo: h.repo,
            id: h.entry.id,
            title: h.entry.title,
            type: h.entry.type,
            score: h.score,
            content: h.entry.content,
          })),
        });
        return;
      }

      /* ── Sync ────────────────────────────────────────── */
      if (req.method === "GET" && p === "/v1/sync/export") {
        const limit = Number(url.searchParams.get("limit") || 10000);
        const bundle = exportBundle(engine, { limit, source: "api" });
        void publishWebhook(
          "sync.exported",
          { count: bundle.memories.length },
          webhookEndpoints,
        );
        json(res, 200, bundle);
        return;
      }
      if (req.method === "POST" && p === "/v1/sync/import") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const bundle = parseBundle(body);
        const result = importBundle(engine, bundle);
        void publishWebhook("sync.imported", { ...result }, webhookEndpoints);
        json(res, 200, result);
        return;
      }

      /* ── Analyze ─────────────────────────────────────── */
      if (req.method === "GET" && p === "/v1/analyze") {
        const report = await analyzeProject({
          cwd,
          topN: Number(url.searchParams.get("top") || 15),
        });
        json(res, 200, {
          filesScanned: report.filesScanned,
          summary: report.summary,
          hotspots: report.hotspots,
          deadCode: report.deadCode.slice(0, 50),
        });
        return;
      }

      /* ── Review / chat / generators ──────────────────── */
      if (req.method === "POST" && p === "/v1/review") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const title = String(body.title || "API review");
        const memories = engine.hybridSearch(
          `${title} ${body.body || ""}`.slice(0, 500),
          5,
        );
        const reviewResult = {
          title,
          relatedMemories: memories.map((m) => ({
            id: m.entry.id,
            title: m.entry.title,
            type: m.entry.type,
            rankScore: m.rankScore,
            content: m.entry.content.slice(0, 300),
          })),
        };
        void publishWebhook(
          "review.completed",
          { title, score: reviewResult.relatedMemories[0]?.rankScore },
          webhookEndpoints,
        );
        json(res, 200, reviewResult);
        return;
      }

      if (req.method === "POST" && p === "/v1/chat") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const question = String(body.question || body.q || "").trim();
        if (!question)
          throw new AppError("CONFIG_INVALID", "question is required", {
            statusCode: 400,
          });
        const result = await repoChat({
          engine,
          question,
          extraContext: body.context ? String(body.context) : undefined,
          history: Array.isArray(body.history) ? body.history : undefined,
        });
        if (body.conversationId) {
          engine.recordConversation({
            conversationId: String(body.conversationId),
            question,
            answer: result.answer,
            sourceMemories: result.sources.map((s) => s.id),
          });
        }
        json(res, 200, result);
        return;
      }

      if (req.method === "POST" && p === "/v1/commit-message") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const input = String(body.input || body.diff || body.summary || "");
        if (!input.trim())
          throw new AppError("CONFIG_INVALID", "input is required", {
            statusCode: 400,
          });
        json(res, 200, await generateCommitMessage({ input }));
        return;
      }

      if (req.method === "POST" && p === "/v1/release-notes") {
        const body = JSON.parse((await readBody(req)) || "{}");
        json(
          res,
          200,
          await generateReleaseNotes({
            version: String(body.version || "v0.0.0"),
            items: Array.isArray(body.items) ? body.items.map(String) : [],
            projectName: body.projectName
              ? String(body.projectName)
              : "HEXVault",
          }),
        );
        return;
      }

      if (req.method === "POST" && p === "/v1/changelog") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const items = Array.isArray(body.items)
          ? body.items.map((i: unknown) =>
              typeof i === "string"
                ? { title: i }
                : (i as { type?: string; title: string }),
            )
          : [];
        json(
          res,
          200,
          await generateChangelog({
            version: String(body.version || "v0.0.0"),
            items,
            projectName: body.projectName
              ? String(body.projectName)
              : "HEXVault",
          }),
        );
        return;
      }

      if (req.method === "POST" && p === "/v1/explain") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const code = String(body.code || "");
        if (!code.trim())
          throw new AppError("CONFIG_INVALID", "code is required", {
            statusCode: 400,
          });
        json(
          res,
          200,
          await explainCode(
            code,
            body.language ? String(body.language) : "typescript",
          ),
        );
        return;
      }

      if (req.method === "POST" && p === "/v1/deps") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const manifests = Array.isArray(body.manifests)
          ? (body.manifests as Array<{
              path: string;
              json: Record<string, unknown>;
            }>)
          : [];
        json(
          res,
          200,
          await analyzeDependencyReport(manifests, {
            review: Boolean(body.review),
          }),
        );
        return;
      }

      if (req.method === "POST" && p === "/v1/webhook/test") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const { deliverWebhooks } = await import("../core/webhooks/emitter.js");
        const results = await deliverWebhooks(
          {
            type: "memory.added",
            payload: {
              test: true,
              message: body.message
                ? String(body.message)
                : "HEXVault webhook test",
            },
            timestamp: new Date().toISOString(),
          },
          webhookEndpoints,
        );
        json(res, 200, { delivered: results.length, results });
        return;
      }

      json(res, 404, {
        error: "Not found",
        endpoints: [
          "GET /health",
          "GET|POST|PATCH|DELETE /v1/memories",
          "GET /v1/search?q=",
          "GET /v1/stats",
          "GET /v1/analytics",
          "GET /v1/timeline",
          "GET /v1/tags",
          "GET /v1/health/memory",
          "GET /v1/graph",
          "POST /graphql",
          "GET /v1/sync/export",
          "POST /v1/sync/import",
          "GET /v1/multi-repo/search",
          "GET /v1/analyze",
          "POST /v1/review",
          "POST /v1/chat",
          "POST /v1/commit-message",
          "POST /v1/release-notes",
          "POST /v1/changelog",
          "POST /v1/explain",
          "POST /v1/deps",
          "POST /v1/webhook/test",
        ],
      });
    } catch (err) {
      if (isAppError(err)) {
        json(res, err.statusCode, err.toJSON());
        return;
      }
      logger.error("API error", {
        error: err instanceof Error ? err.message : String(err),
      });
      json(res, 500, { error: "Internal server error" });
    }
  });

  return {
    server,
    engine,
    port,
    host,
    start(): Promise<void> {
      return new Promise((resolve) => {
        server.listen(port, host, () => {
          logger.info(
            `HEXVault API v${VERSION} listening on http://${host}:${port}`,
          );
          resolve();
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((e) => {
          engine.close();
          if (e) {
            reject(e);
          } else {
            resolve();
          }
        });
      });
    },
  };
}

if (
  process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js")
) {
  createApiServer()
    .start()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
