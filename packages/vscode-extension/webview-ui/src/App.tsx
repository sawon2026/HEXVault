import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAsk, fetchHealth, fetchSearch, queryKeys } from "./api";

export function App() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [mode, setMode] = useState<"search" | "ask" | "health" | null>(null);
  const qc = useQueryClient();

  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
    enabled: mode === "health",
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const searchQuery = useQuery({
    queryKey: queryKeys.search(submitted),
    queryFn: () => fetchSearch(submitted),
    enabled: mode === "search" && submitted.length > 0,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => fetchAsk(q),
  });

  const busy =
    (mode === "search" && searchQuery.isFetching) ||
    (mode === "health" && healthQuery.isFetching) ||
    askMutation.isPending;

  const error =
    (mode === "search" && searchQuery.error?.message) ||
    (mode === "health" && healthQuery.error?.message) ||
    (mode === "ask" && askMutation.error?.message) ||
    null;

  const onSearch = () => {
    const q = query.trim();
    if (!q) return;
    setMode("search");
    setSubmitted(q);
  };

  const onAsk = () => {
    const q = query.trim();
    if (!q) return;
    setMode("ask");
    askMutation.mutate(q);
  };

  const onHealth = () => {
    setMode("health");
    void qc.invalidateQueries({ queryKey: queryKeys.health });
  };

  const hits = searchQuery.data?.results || [];
  const answer = askMutation.data
    ? `${askMutation.data.answer || "(no answer)"}${askMutation.data.source ? `\n\n— ${askMutation.data.source}` : ""}`
    : null;
  const healthText = healthQuery.data ? JSON.stringify(healthQuery.data, null, 2) : null;

  const fromCache =
    mode === "search" && searchQuery.isSuccess && !searchQuery.isFetching
      ? searchQuery.isStale ? "stale cache" : "cache hit"
      : mode === "health" && healthQuery.isSuccess && !healthQuery.isFetching
        ? healthQuery.isStale ? "stale cache" : "cache hit"
        : null;

  return (
    <div className="app">
      <header className="header">
        <h2>HEXVault</h2>
        <p className="muted">TanStack Query cache · Search · Ask · Health</p>
      </header>
      <div className="row">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Search memories or ask…"
          disabled={busy}
        />
      </div>
      <div className="row actions">
        <button className="btn primary" disabled={busy} onClick={onSearch}>Search</button>
        <button className="btn primary" disabled={busy} onClick={onAsk}>Ask</button>
        <button className="btn secondary" disabled={busy} onClick={onHealth}>Health</button>
      </div>
      {fromCache && <div className="cache-badge">📦 {fromCache}</div>}
      {busy && <div className="status">Working…</div>}
      {error && <div className="error">{error}</div>}
      {mode === "search" && !busy && searchQuery.isSuccess && (
        <section className="results">
          {hits.length === 0 ? (
            <p className="muted">No results.</p>
          ) : (
            hits.map((h, i) => (
              <article key={h.id || i} className="card">
                <div className="meta">
                  {i + 1}. {h.title || h.id || "memory"}{" "}
                  <span className="badge">{h.type || "note"}</span>
                </div>
                <p className="body">{(h.content || "").slice(0, 280)}</p>
              </article>
            ))
          )}
        </section>
      )}
      {mode === "ask" && answer && !busy && (
        <section className="card answer"><pre>{answer}</pre></section>
      )}
      {mode === "health" && healthText && !busy && (
        <section className="card"><pre>{healthText}</pre></section>
      )}
    </div>
  );
}
