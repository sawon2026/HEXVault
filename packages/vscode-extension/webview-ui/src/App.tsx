import React, { useEffect, useState } from "react";

type VsCodeApi = { postMessage: (msg: unknown) => void };
type SearchHit = { id?: string; title?: string; type?: string; content?: string };
type Props = { vscode: VsCodeApi };

export function App({ vscode }: Props) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "search" | "ask" | "health">("idle");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [health, setHealth] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      setBusy(false);
      if (msg?.type === "error") {
        setError(String(msg.message || "Error"));
        return;
      }
      setError(null);
      if (msg?.type === "searchResult") {
        setMode("search");
        setHits(msg.result?.results || []);
        setAnswer(null);
        setHealth(null);
      } else if (msg?.type === "askResult") {
        setMode("ask");
        const r = msg.result || {};
        setAnswer((r.answer || "(no answer)") + (r.source ? `\n\n— ${r.source}` : ""));
        setHits([]);
        setHealth(null);
      } else if (msg?.type === "healthResult") {
        setMode("health");
        setHealth(JSON.stringify(msg.result, null, 2));
        setHits([]);
        setAnswer(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const send = (type: string) => {
    const q = query.trim();
    if ((type === "search" || type === "ask") && !q) return;
    setBusy(true);
    setError(null);
    vscode.postMessage({ type, query: q });
  };

  return (
    <div className="app">
      <header className="header">
        <h2>HEXVault</h2>
        <p className="muted">Search · Ask · Health</p>
      </header>
      <div className="row">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send("search")}
          placeholder="Search memories or ask a question…"
          disabled={busy}
        />
      </div>
      <div className="row actions">
        <button className="btn primary" disabled={busy} onClick={() => send("search")}>
          Search
        </button>
        <button className="btn primary" disabled={busy} onClick={() => send("ask")}>
          Ask
        </button>
        <button className="btn secondary" disabled={busy} onClick={() => send("health")}>
          Health
        </button>
      </div>
      {busy && <div className="status">Working…</div>}
      {error && <div className="error">{error}</div>}
      {mode === "search" && !busy && (
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
        <section className="card answer">
          <pre>{answer}</pre>
        </section>
      )}
      {mode === "health" && health && !busy && (
        <section className="card">
          <pre>{health}</pre>
        </section>
      )}
    </div>
  );
}
