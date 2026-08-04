const BASE =
  typeof window === "undefined"
    ? process.env.HEXVAULT_API_URL || "http://127.0.0.1:3850"
    : "/api/hex";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export type Memory = {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
};

export async function fetchHealth() {
  try {
    return await get<{ ok: boolean; version?: string }>("/health");
  } catch {
    return { ok: false as const };
  }
}

export async function fetchMemories(limit = 50) {
  return get<{ count: number; items: Memory[] }>(`/v1/memories?limit=${limit}`);
}

export async function fetchStats() {
  return get<{ total: number; byType: Record<string, number> }>("/v1/stats");
}

export async function fetchAnalytics() {
  return get<{ total: number; byType?: Record<string, number> }>("/v1/analytics");
}

export async function searchMemories(q: string) {
  return get<{ count: number; results: any[] }>(
    `/v1/search?q=${encodeURIComponent(q)}&limit=20`
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

export async function chat(question: string) {
  return post<{ answer: string; sources: { title: string }[]; source: string }>("/v1/chat", {
    question,
  });
}

export async function addMemory(data: {
  title: string;
  content: string;
  type?: string;
  tags?: string[];
}) {
  return post<Memory>("/v1/memories", data);
}

export async function fetchGraph(limit = 60) {
  return get<{
    nodes: {
      id: string;
      label: string;
      kind: string;
      memoryType?: string;
      size: number;
      x: number;
      y: number;
    }[];
    edges: { source: string; target: string; kind: string; weight: number }[];
    stats: { memories: number; types: number; tags: number; edges: number };
  }>(`/v1/graph?limit=${limit}&w=900&h=560`);
}
