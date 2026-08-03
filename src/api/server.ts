/**
 * HEXVault REST API — zero-dependency HTTP server.
 *
 * GET  /health
 * GET  /v1/memories | POST /v1/memories | GET /v1/memories/:id
 * GET  /v1/search?q=
 * POST /v1/review
 * GET  /v1/stats | GET /v1/analytics
 *
 * Optional auth: Authorization: Bearer <HEXVAULT_API_TOKEN>
 */
import http from "http";
import { URL } from "url";
import path from "path";
import { MemoryEngine } from "../core/memory/engine.js";
import type { MemoryType } from "../core/memory/types.js";
import { loadConfig } from "../config/index.js";
import { log } from "../core/logging/logger.js";
import { AppError, isAppError } from "../core/errors/app-error.js";

const logger = log.child("api");

function json(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(payload);
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
        json(res, 200, { ok: true, service: "hexvault-api", version: "1.1.0" });
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
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const title = String(body.title || body.content || "").slice(0, 200);
        const content = String(body.content || body.title || "");
        if (!content) {
          throw new AppError("CONFIG_INVALID", "content is required", {
            statusCode: 400,
          });
        }
        const entry = engine.add(title || content.slice(0, 80), content, {
          type: body.type || "note",
          tags: body.tags || [],
          files: body.files || [],
          source: body.source || "api",
        });
        json(res, 201, entry);
        return;
      }

      if (req.method === "GET" && p === "/v1/search") {
        const q =
          url.searchParams.get("q") || url.searchParams.get("query") || "";
        if (!q) {
          throw new AppError("CONFIG_INVALID", "query parameter q is required", {
            statusCode: 400,
          });
        }
        const limit = Number(url.searchParams.get("limit") || 10);
        const hits = engine.hybridSearch(q, limit);
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
            matchedOn: h.matchedOn,
            content: h.entry.content,
            tags: h.entry.tags,
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

      if (req.method === "POST" && p === "/v1/review") {
        const raw = await readBody(req);
        const body = raw ? JSON.parse(raw) : {};
        const title = String(body.title || "API review");
        const diff = String(body.body || body.diff || "");
        const memories = engine.hybridSearch(`${title} ${diff}`.slice(0, 500), 5);
        json(res, 200, {
          title,
          summary: memories.length
            ? `Found ${memories.length} related project memories.`
            : "No related memories — rule-based context only.",
          relatedMemories: memories.map((m) => ({
            id: m.entry.id,
            title: m.entry.title,
            type: m.entry.type,
            rankScore: m.rankScore,
          })),
        });
        return;
      }

      json(res, 404, {
        error: "Not found",
        endpoints: [
          "GET /health",
          "GET /v1/memories",
          "POST /v1/memories",
          "GET /v1/memories/:id",
          "GET /v1/search?q=",
          "POST /v1/review",
          "GET /v1/stats",
          "GET /v1/analytics",
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
          logger.info(`HEXVault API listening on http://${host}:${port}`);
          resolve();
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          engine.close();
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}

if (
  process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js")
) {
  const api = createApiServer();
  api.start().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
