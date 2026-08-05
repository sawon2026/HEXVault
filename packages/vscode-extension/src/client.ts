import * as vscode from "vscode";

export interface SearchHit {
  id?: string;
  title?: string;
  type?: string;
  content?: string;
  rankScore?: number;
}

export interface SearchResult {
  query?: string;
  count?: number;
  results?: SearchHit[];
}

export interface ChatResult {
  answer?: string;
  source?: string;
}

function config() {
  const c = vscode.workspace.getConfiguration("hexvault");
  return {
    baseUrl: (c.get<string>("baseUrl") || "http://127.0.0.1:3850").replace(/\/$/, ""),
    token: c.get<string>("token") || "",
    timeoutMs: c.get<number>("timeoutMs") || 30_000,
  };
}

export class HexVaultClient {
  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const { baseUrl, token, timeoutMs } = config();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try { data = JSON.parse(text); } catch { data = text; }
      }
      if (!res.ok) {
        throw new Error(`HEXVault API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  health(): Promise<Record<string, unknown>> {
    return this.request("GET", "/health") as Promise<Record<string, unknown>>;
  }

  search(query: string, limit = 15): Promise<SearchResult> {
    const q = encodeURIComponent(query);
    return this.request("GET", `/v1/search?q=${q}&limit=${limit}`) as Promise<SearchResult>;
  }

  addMemory(input: { content: string; title?: string; type?: string; tags?: string[] }): Promise<Record<string, unknown>> {
    return this.request("POST", "/v1/memories", {
      content: input.content,
      title: input.title || input.content.slice(0, 80),
      type: input.type || "note",
      tags: input.tags || ["vscode"],
      source: "vscode-extension",
    }) as Promise<Record<string, unknown>>;
  }

  chat(question: string): Promise<ChatResult> {
    return this.request("POST", "/v1/chat", { question }) as Promise<ChatResult>;
  }
}
