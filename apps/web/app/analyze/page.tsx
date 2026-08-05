"use client";

import { useEffect, useState } from "react";
import { fetchAnalyze } from "@/lib/api";
import { StatCard } from "@/components/StatCard";

export default function AnalyzePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchAnalyze>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyze()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Analyze</h1>
        <p className="mt-1 text-sm text-hex-muted">
          Complexity hotspots and dead-code heuristics
        </p>
      </div>

      {loading && <p className="text-sm text-hex-muted">Scanning…</p>}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error} — ensure API is running from the repo root.
        </p>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Files scanned" value={data.filesScanned} />
            <StatCard label="Avg complexity" value={`${data.summary.avgScore}/100`} />
            <StatCard label="Dead-code hints" value={data.summary.deadHints} />
          </div>

          <div className="card p-5">
            <h2 className="font-medium">Hotspots</h2>
            <ul className="mt-3 space-y-2">
              {(data.hotspots || []).map((h) => (
                <li
                  key={h.file}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-500/10 px-3 py-2 text-sm dark:bg-slate-950/40"
                >
                  <span className="truncate font-mono text-xs text-hex-muted-light dark:text-slate-300">{h.file}</span>
                  <span className="shrink-0 tabular-nums text-amber-500 dark:text-amber-300">{h.score}</span>
                </li>
              ))}
              {!data.hotspots?.length && (
                <li className="text-sm text-hex-muted">No high-complexity files.</li>
              )}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="font-medium">Hints</h2>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {(data.deadCode || []).slice(0, 40).map((d, i) => (
                <li key={i} className="text-sm text-hex-muted">
                  <span className="font-mono text-xs text-hex-muted-light dark:text-slate-400">
                    {d.file}:{d.line}
                  </span>{" "}
                  <span className="badge bg-rose-500/15 text-rose-500 dark:text-rose-300">{d.kind}</span>{" "}
                  {d.symbol}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
