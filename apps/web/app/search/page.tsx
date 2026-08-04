"use client";
import { useState } from "react";
import { searchMemories } from "@/lib/api";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchMemories(q.trim());
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hybrid search</h1>
        <p className="mt-1 text-sm text-hex-muted">Keyword + semantic ranking</p>
      </div>
      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
        <input className="input flex-1" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <ul className="space-y-3">
        {results.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex justify-between">
              <span className="badge bg-cyan-500/15 text-cyan-300">{r.type}</span>
              <span className="text-xs text-slate-500">rank {r.rankScore?.toFixed?.(2)}</span>
            </div>
            <h3 className="mt-2 font-medium">{r.title}</h3>
            <p className="mt-1 text-sm text-hex-muted line-clamp-3">{r.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
