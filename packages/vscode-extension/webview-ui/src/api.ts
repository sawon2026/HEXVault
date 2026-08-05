import { bridgeCall } from "./bridge";

export type SearchHit = {
  id?: string;
  title?: string;
  type?: string;
  content?: string;
  rankScore?: number;
};

export type SearchResult = {
  query?: string;
  count?: number;
  results?: SearchHit[];
};

export type ChatResult = { answer?: string; source?: string };
export type HealthResult = Record<string, unknown>;

export const queryKeys = {
  health: ["hexvault", "health"] as const,
  search: (q: string) => ["hexvault", "search", q] as const,
};

export function fetchHealth() {
  return bridgeCall<HealthResult>({ type: "health" });
}

export function fetchSearch(query: string) {
  return bridgeCall<SearchResult>({ type: "search", query });
}

export function fetchAsk(question: string) {
  return bridgeCall<ChatResult>({ type: "ask", query: question });
}
