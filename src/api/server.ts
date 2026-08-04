/**
 * HEXVault REST API v1.3.1
 */
import http from "http";
import { URL } from "url";
import path from "path";
import { MemoryEngine } from "../core/memory/engine.js";
import type { MemoryType } from "../core/memory/types.js";
import { loadConfig } from "../config/index.js";
import { log } from "../core/logging/logger.js";
import { AppError, isAppError } from "../core/errors/app-error.js";
import { generateCommitMessage, generateReleaseNotes } from "../core/ai/generators.js";
import { repoChat } from "../core/ai/repo-chat.js";
import { analyzeProject } from "../core/analysis/heuristics.js";
import { buildKnowledgeGraph, layoutGraph } from "../core/graph/builder.js";

const logger = log.child("api");

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
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
    throw new AppError("PROVIDER_AUTH", "Invalid or missing API token", { statusCode: 401 });
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
  const engine = new MemoryEngine({ dbPath });

  const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      json(res, 204, {});
      return;
    }
    try {
      checkAuth(req);
      const url = new URL(req.url || "/", `http://${host}:${port}`);
      const p = url.pathname.replace(/\/$/, "") || "/";

      if (req.method === "GET" && (p === "/health" || p === "/v1/health")) {
        json(res, 200, { ok: true, service: "hexvault-api", version: "1.3.1" });
        return;
      }
      if (req.method === "GET" && p === "/v1/memories") {
        const limit = Number(url.searchParams.get("limit") || 50);
        const type = url.searchParams.get("type") as MemoryType | null;
        const items = engine.list(limit, type || undefined);
        json(res, 200, { count: items.length, items });
        return;
      }
      const memMatch = p.match(/^\/v1\/memories\/([^/]+)$/);
      if (req.method === "GET" && memMatch) {
        const item = engine.get(memMatch[1]);
        if (!item) {
          json(res, 404, { error: "Memory not found" });
          return;
        }
        json(res, 200, item);
        return;
      }
      if (req.method === "POST" && p === "/v1/memories") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const content = String(body.content || body.title || "");
        if (!content) throw new AppError("CONFIG_INVALID", "content is required", { statusCode: 400 });
        const entry = engine.add(String(body.title || content).slice(0, 200), content, {
          type: body.type || "note",
          tags: body.tags || [],
          files: body.files || [],
          source: body.source || "api",
        });
        json(res, 201, entry);
        return;
      }
      if (req.method === "GET" && p === "/v1/search") {
        const q = url.searchParams.get("q") || url.searchParams.get("query") || "";
        if (!q) throw new AppError("CONFIG_INVALID", "q is required", { statusCode: 400 });
        const hits = engine.hybridSearch(q, Number(url.searchParams.get("limit") || 10));
        json(res, 200, {
          query: q,
          count: hits.length,
          results: hits.map((h) => ({
            id: h.entry.id,
            title: h.entry.title,
            type: h.entry.type,
            score: h.score,
            rankScore: h.rankScore,
            content: h.entry.content,
          })),
        });
        return;
      }
      if (req.method === "GET" && p === "/v1/stats") {
        json(res, 200, engine.stats());
        return;
      }
      if (req.method === "GET" && p === "/v1/analytics") {
        json(res, 200, engine.analytics());
        return;
      }
      if (req.method === "GET" && p === "/v1/graph") {
        const limit = Number(url.searchParams.get("limit") || 60);
        const memories = engine.list(limit);
        const graph = buildKnowledgeGraph(memories, { maxMemories: limit });
        const w = Number(url.searchParams.get("w") || 900);
        const h = Number(url.searchParams.get("h") || 600);
        const laid = layoutGraph(graph, w, h);
        json(res, 200, { ...laid, stats: graph.stats });
        return;
      }
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
      if (req.method === "POST" && p === "/v1/review") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const title = String(body.title || "API review");
        const memories = engine.hybridSearch(`${title} ${body.body || ""}`.slice(0, 500), 5);
        json(res, 200, {
          title,
          relatedMemories: memories.map((m) => ({
            id: m.entry.id,
            title: m.entry.title,
            rankScore: m.rankScore,
          })),
        });
        return;
      }
      if (req.method === "POST" && p === "/v1/chat") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const question = String(body.question || body.q || "").trim();
        if (!question) throw new AppError("CONFIG_INVALID", "question is required", { statusCode: 400 });
        json(res, 200, await repoChat({ engine, question, extraContext: body.context ? String(body.context) : undefined }));
        return;
      }
      if (req.method === "POST" && p === "/v1/commit-message") {
        const body = JSON.parse((await readBody(req)) || "{}");
        const input = String(body.input || body.diff || body.summary || "");
        if (!input.trim()) throw new AppError("CONFIG_INVALID", "input is required", { statusCode: 400 });
        json(res, 200, await generateCommitMessage({ input }));
        return;
      }
      if (req.method === "POST" && p === "/v1/release-notes") {
        const body = JSON.parse((await readBody(req)) || "{}");
        json(res, 200, await generateReleaseNotes({
          version: String(body.version || "v0.0.0"),
          items: Array.isArray(body.items) ? body.items.map(String) : [],
          projectName: body.projectName ? String(body.projectName) : "HEXVault",
        }));
        return;
      }

      json(res, 404, {
        error: "Not found",
        endpoints: [
          "GET /health",
          "GET|POST /v1/memories",
          "GET /v1/search?q=",
          "GET /v1/graph",
          "GET /v1/analyze",
          "POST /v1/review",
          "POST /v1/chat",
          "POST /v1/commit-message",
          "POST /v1/release-notes",
          "GET /v1/stats",
          "GET /v1/analytics",
        ],
      });
    } catch (err) {
      if (isAppError(err)) {
        json(res, err.statusCode, err.toJSON());
        return;
      }
      logger.error("API error", { error: err instanceof Error ? err.message : String(err) });
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
          logger.info(`HEXVault API listening on http://${host}:${port}`);
          resolve();
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((e) => {
          engine.close();
          e ? reject(e) : resolve();
        });
      });
    },
  };
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  createApiServer().start().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
