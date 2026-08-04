"use client";
import { useEffect, useMemo, useState } from "react";
import { fetchGraph } from "@/lib/api";
import { StatCard } from "@/components/StatCard";

type GNode = {
  id: string;
  label: string;
  kind: string;
  memoryType?: string;
  size: number;
  x: number;
  y: number;
};
type GEdge = { source: string; target: string; kind: string; weight: number };

const KIND_COLOR: Record<string, string> = {
  memory: "#22D3EE",
  type: "#A78BFA",
  tag: "#4ADE80",
};

export default function GraphPage() {
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [stats, setStats] = useState({ memories: 0, types: 0, tags: 0, edges: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [filter, setFilter] = useState<"all" | "memory" | "type" | "tag">("all");

  useEffect(() => {
    fetchGraph(60)
      .then((g) => {
        setNodes(g.nodes || []);
        setEdges(g.edges || []);
        setStats(g.stats || { memories: 0, types: 0, tags: 0, edges: 0 });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  const pos = useMemo(() => {
    const m = new Map<string, GNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const W = 900;
  const H = 560;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge graph</h1>
          <p className="mt-1 text-sm text-hex-muted">Memories · types · tags</p>
        </div>
        <div className="flex gap-2">
          {(["all", "memory", "type", "tag"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={filter === f ? "btn-primary" : "btn-ghost"}>
              {f}
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="text-sm text-hex-muted">Building graph…</p>}
      {error && <p className="text-sm text-red-300">{error} — run npm run api</p>}
      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Memories" value={stats.memories} />
            <StatCard label="Types" value={stats.types} />
            <StatCard label="Tags" value={stats.tags} />
            <StatCard label="Edges" value={stats.edges} />
          </div>
          <div className="card overflow-hidden p-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-[min(70vh,560px)] w-full">
              <rect width={W} height={H} fill="#0B1220" rx="12" />
              {edges.map((e, i) => {
                const a = pos.get(e.source);
                const b = pos.get(e.target);
                if (!a || !b) return null;
                if (filter !== "all" && a.kind !== filter && b.kind !== filter) return null;
                const stroke = e.kind === "has-type" ? "#A78BFA55" : e.kind === "has-tag" ? "#4ADE8055" : "#64748B44";
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={e.kind === "related" ? 0.8 : 1.4} />;
              })}
              {nodes.filter((n) => filter === "all" || n.kind === filter).map((n) => {
                const r = 6 + Math.min(n.size, 12) * 0.4;
                const fill = KIND_COLOR[n.kind] || "#94A3B8";
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer" onClick={() => setSelected(n)}>
                    <circle r={r} fill={fill} opacity={0.9} stroke={selected?.id === n.id ? "#F8FAFC" : "transparent"} strokeWidth={2} />
                    {(n.kind !== "memory" || selected?.id === n.id) && (
                      <text y={r + 12} textAnchor="middle" fill="#94A3B8" fontSize={9}>{n.label.slice(0, 18)}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {selected && (
            <div className="card p-4 text-sm">
              <p className="text-xs uppercase text-hex-muted">{selected.kind}</p>
              <p className="mt-1 font-medium">{selected.label}</p>
              {selected.memoryType && <p className="mt-1 text-hex-muted">type: {selected.memoryType}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
