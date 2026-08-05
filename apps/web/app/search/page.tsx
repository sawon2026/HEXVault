"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { searchMemories } from "@/lib/api";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<
    { id: string; title: string; type: string; rankScore: number; content: string }[]
  >([]);
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
        <p className="mt-1 text-sm text-hex-muted">Keyword + semantic ranking over memories</p>
      </div>

      <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="Search e.g. auth, sqlite, architecture…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <ul className="space-y-3">
        {results.map((r) => (
          <motion.li
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="badge bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">{r.type}</span>
              <span className="text-xs tabular-nums text-hex-muted-light dark:text-hex-muted">
                rank {r.rankScore?.toFixed?.(2) ?? "—"}
              </span>
            </div>
            <h3 className="mt-2 font-medium">{r.title}</h3>
            <p className="mt-1 text-sm text-hex-muted-light line-clamp-3 dark:text-hex-muted">{r.content}</p>
            <Link
              href={`/memories?focus=${encodeURIComponent(r.id)}`}
              className="mt-2 inline-block text-xs text-cyan-600 hover:underline dark:text-cyan-300"
            >
              View memory →
            </Link>
          </motion.li>
        ))}
        {!error && results.length === 0 && q && !loading && (
          <li className="card py-10 text-center text-sm text-hex-muted">No results for “{q}”.</li>
        )}
      </ul>
    </div>
  );
}
