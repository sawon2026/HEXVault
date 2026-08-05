/**
 * Client for HEXVault REST API (proxied via /api/hex in Next.js).
 * v3.0.0 — supports memories CRUD, search, chat, analytics, timeline, tags,
 * health, graph, providers, webhooks.
 */

const BASE =
  typeof window === "undefined"
    ? process.env.HEXVAULT_API_URL || "http://127.0.0.1:3850"
    : "/api/hex";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type Memory = {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  files?: string[];
  source?: string;
  category?: string;
  importance?: number;
  createdAt: string;
  updatedAt?: string;
};

export type SearchHit = {
  id: string;
  title: string;
  type: string;
  score: number;
  rankScore: number;
  importance?: number;
  content: string;
};

export async function fetchHealth() {
  try {
    return await get<{
      ok: boolean;
      version?: string;
      uptimeSec?: number;
      node?: string;
      providers?: Record<string, { configured: boolean; env: string }>;
      webhooks?: number;
    }>("/health");
  } catch {
    return { ok: false as const };
  }
}

export async function fetchMemories(limit = 50, type?: string) {
  const q = type ? `&type=${encodeURIComponent(type)}` : "";
  return get<{ count: number; items: Memory[] }>(`/v1/memories?limit=${limit}${q}`);
}

export async function fetchStats() {
  return get<{ total: number; byType: Record<string, number>; byCategory?: Record<string, number> }>("/v1/stats");
}

export async function fetchAnalytics() {
  return get<{
    total: number;
    byType?: Record<string, number>;
    topRecent?: { id: string; title: string; importance: number }[];
    timeline?: { date: string; count: number; types: Record<string, number> }[];
    tagCloud?: { tag: string; count: number }[];
  }>("/v1/analytics");
}

export async function fetchTimeline(limit = 200) {
  return get<{ items: { date: string; count: number; types: Record<string, number> }[] }>(
    `/v1/timeline?limit=${limit}`
  );
}

export async function fetchTags(limit = 100) {
  return get<{ tags: { tag: string; count: number }[] }>(`/v1/tags?limit=${limit}`);
}

export async function fetchMemoryHealth() {
  return get<{
    ok: boolean;
    total: number;
    expiredCount: number;
    staleCount: number;
    importanceAvg: number;
    importanceHigh: number;
    categoryCount: number;
    tagsCount: number;
    linksCount: number;
    orphanedCount: number;
    recentActivity: number;
    warnings: string[];
    recommendations: string[];
  }>("/v1/health/memory");
}

export async function searchMemories(q: string, limit = 20) {
  return get<{ query: string; count: number; results: SearchHit[] }>(
    `/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`
  );
}

export async function fetchAnalyze() {
  return get<{
    filesScanned: number;
    summary: { avgScore: number; maxScore: number; deadHints: number };
    hotspots: { file: string; score: number; lines: number; cyclomaticApprox: number }[];
    deadCode: { file: string; kind: string; line: number; symbol: string }[];
  }>("/v1/analyze?top=12");
}

export async function chat(
  question: string,
  opts?: { conversationId?: string }
) {
  return post<{
    answer: string;
    sources?: { id: string; title: string; relevance?: number }[];
    conversationId?: string;
  }>("/v1/chat", { question, conversationId: opts?.conversationId });
}

export async function addMemory(data: {
  title: string;
  content: string;
  type?: string;
  tags?: string[];
  category?: string;
  importance?: number;
  ttlDays?: number;
}) {
  return post<Memory>("/v1/memories", data);
}

export async function deleteMemory(id: string) {
  return del<{ ok: boolean; deleted: string }>(`/v1/memories/${encodeURIComponent(id)}`);
}

export async function fetchGraph(limit = 60, w = 900, h = 560) {
  return get<{
    nodes: { id: string; label: string; kind: string; memoryType?: string; size: number; x: number; y: number }[];
    edges: { source: string; target: string; kind: string; weight: number }[];
    stats: { memories: number; types: number; tags: number; edges: number };
  }>(`/v1/graph?limit=${limit}&w=${w}&h=${h}`);
}

export async function webhookTest(message: string) {
  return post<{ delivered: number; results: { url: string; ok: boolean; status?: number }[] }>(
    "/v1/webhook/test",
    { message }
  );
}

export async function commitMessage(input: string) {
  return post<{ message: string; source: string }>("/v1/commit-message", { input });
}
