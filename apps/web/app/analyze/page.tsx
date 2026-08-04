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
        <p className="mt-1 text-sm text-hex-muted">Complexity hotspots and dead-code hints</p>
      </div>
      {loading && <p className="text-sm text-hex-muted">Scanning…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}
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
                <li key={h.file} className="flex justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-2 text-sm">
                  <span className="truncate font-mono text-xs text-slate-300">{h.file}</span>
                  <span className="text-amber-300 tabular-nums">{h.score}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="font-medium">Hints</h2>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {(data.deadCode || []).slice(0, 40).map((d, i) => (
                <li key={i} className="text-sm text-hex-muted">
                  <span className="font-mono text-xs">{d.file}:{d.line}</span>{" "}
                  <span className="badge bg-rose-500/15 text-rose-300">{d.kind}</span> {d.symbol}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
