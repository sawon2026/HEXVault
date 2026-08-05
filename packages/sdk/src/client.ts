/**
 * HEXVault API client — works in Node 18+ and modern browsers (fetch).
 */
import type {
  AnalyzeReport,
  ChangelogResult,
  ChatResult,
  CommitMessageResult,
  ExplainResult,
  HealthStatus,
  KnowledgeGraph,
  Memory,
  MemoryHealth,
  MemoryType,
  ReleaseNotesResult,
  ReviewResult,
  SearchHit,
  Stats,
  TagCount,
  TimelineItem,
  WebhookTestResult,
} from "./types.js";
import { HexVaultApiError } from "./types.js";

export interface HexVaultClientOptions {
  /** Base URL without trailing slash, e.g. http://127.0.0.1:3850 */
  baseUrl?: string;
  /** Optional Bearer token (HEXVAULT_API_TOKEN) */
  token?: string;
  /** Request timeout ms (Node AbortSignal) */
  timeoutMs?: number;
  /** Custom fetch (tests / edge runtimes) */
  fetch?: typeof globalThis.fetch;
}

export class HexVaultClient {
  readonly baseUrl: string;
  private token?: string;
  private timeoutMs: number;
  private fetchImpl: typeof globalThis.fetch;

  constructor(opts: HexVaultClientOptions = {}) {
    this.baseUrl = (opts.baseUrl || "http://127.0.0.1:3850").replace(/\/$/, "");
    this.token = opts.token ?? process.env.HEXVAULT_API_TOKEN;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (json) h["Content-Type"] = "application/json";
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: this.headers(body !== undefined),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      if (!res.ok) {
        throw new HexVaultApiError(
          `HEXVault API ${method} ${path} → ${res.status}`,
          res.status,
          data,
        );
      }
      return data as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Health ──────────────────────────────────────────────

  health(): Promise<HealthStatus> {
    return this.request("GET", "/health");
  }

  // ── Memories ────────────────────────────────────────────

  listMemories(opts?: {
    limit?: number;
    type?: MemoryType;
  }): Promise<{ count: number; items: Memory[] }> {
    const q = new URLSearchParams();
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.type) q.set("type", opts.type);
    const qs = q.toString();
    return this.request("GET", `/v1/memories${qs ? `?${qs}` : ""}`);
  }

  getMemory(id: string): Promise<Memory> {
    return this.request("GET", `/v1/memories/${encodeURIComponent(id)}`);
  }

  updateMemory(
    id: string,
    patch: {
      title?: string;
      content?: string;
      type?: string;
      tags?: string[];
      files?: string[];
      category?: string;
      importance?: number;
    },
  ): Promise<Memory> {
    return this.request(
      "PATCH",
      `/v1/memories/${encodeURIComponent(id)}`,
      patch,
    );
  }

  deleteMemory(id: string): Promise<{ ok: boolean; deleted: string }> {
    return this.request("DELETE", `/v1/memories/${encodeURIComponent(id)}`);
  }

  addMemory(input: {
    title?: string;
    content: string;
    type?: MemoryType;
    tags?: string[];
    files?: string[];
    source?: string;
    category?: string;
    importance?: number;
    ttlDays?: number;
    autoTag?: boolean;
  }): Promise<Memory> {
    return this.request("POST", "/v1/memories", input);
  }

  // ── Search ──────────────────────────────────────────────

  search(
    query: string,
    limit = 10,
  ): Promise<{ query: string; count: number; results: SearchHit[] }> {
    const q = new URLSearchParams({ q: query, limit: String(limit) });
    return this.request("GET", `/v1/search?${q}`);
  }

  // ── Stats / analytics ───────────────────────────────────

  stats(): Promise<Stats> {
    return this.request("GET", "/v1/stats");
  }

  analytics(): Promise<Record<string, unknown>> {
    return this.request("GET", "/v1/analytics");
  }

  timeline(limit = 200): Promise<{ items: TimelineItem[] }> {
    return this.request("GET", `/v1/timeline?limit=${limit}`);
  }

  tags(limit = 100): Promise<{ tags: TagCount[] }> {
    return this.request("GET", `/v1/tags?limit=${limit}`);
  }

  memoryHealth(): Promise<MemoryHealth> {
    return this.request("GET", "/v1/health/memory");
  }

  // ── AI ──────────────────────────────────────────────────

  chat(
    question: string,
    opts?: {
      context?: string;
      history?: { role: "user" | "assistant"; content: string }[];
      conversationId?: string;
    },
  ): Promise<ChatResult> {
    return this.request("POST", "/v1/chat", {
      question,
      context: opts?.context,
      history: opts?.history,
      conversationId: opts?.conversationId,
    });
  }

  commitMessage(input: string): Promise<CommitMessageResult> {
    return this.request("POST", "/v1/commit-message", { input });
  }

  releaseNotes(opts: {
    version: string;
    items?: string[];
    projectName?: string;
  }): Promise<ReleaseNotesResult> {
    return this.request("POST", "/v1/release-notes", opts);
  }

  changelog(opts: {
    version: string;
    items: { type?: string; title: string }[];
    projectName?: string;
  }): Promise<ChangelogResult> {
    return this.request("POST", "/v1/changelog", opts);
  }

  explain(code: string, language = "typescript"): Promise<ExplainResult> {
    return this.request("POST", "/v1/explain", { code, language });
  }

  webhookTest(message?: string): Promise<WebhookTestResult> {
    return this.request("POST", "/v1/webhook/test", { message });
  }

  review(opts: {
    title?: string;
    body?: string;
    diff?: string;
  }): Promise<ReviewResult> {
    return this.request("POST", "/v1/review", opts);
  }

  // ── Analyze / graph ─────────────────────────────────────

  analyze(top = 15): Promise<AnalyzeReport> {
    return this.request("GET", `/v1/analyze?top=${top}`);
  }

  graphql(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<{ data?: unknown; errors?: { message: string }[] }> {
    return this.request("POST", "/graphql", { query, variables });
  }

  graph(opts?: {
    limit?: number;
    w?: number;
    h?: number;
  }): Promise<KnowledgeGraph> {
    const q = new URLSearchParams();
    if (opts?.limit) q.set("limit", String(opts.limit));
    if (opts?.w) q.set("w", String(opts.w));
    if (opts?.h) q.set("h", String(opts.h));
    const qs = q.toString();
    return this.request("GET", `/v1/graph${qs ? `?${qs}` : ""}`);
  }
}

/** Convenience factory */
export function createClient(opts?: HexVaultClientOptions): HexVaultClient {
  return new HexVaultClient(opts);
}
