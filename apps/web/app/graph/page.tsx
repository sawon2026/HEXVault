"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchGraph } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { useTheme } from "@/components/ThemeProvider";

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
  const { theme } = useTheme();
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [stats, setStats] = useState({ memories: 0, types: 0, tags: 0, edges: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [filter, setFilter] = useState<"all" | "memory" | "type" | "tag">("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    fetchGraph(80)
      .then((g) => {
        setNodes(g.nodes || []);
        setEdges(g.edges || []);
        setStats(g.stats || { memories: 0, types: 0, tags: 0, edges: 0 });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load graph"))
      .finally(() => setLoading(false));
  }, []);

  const searchTerm = search.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!searchTerm) return new Set<string>();
    return new Set(
      nodes.filter((n) => n.label.toLowerCase().includes(searchTerm)).map((n) => n.id)
    );
  }, [nodes, searchTerm]);

  const visible = useMemo(() => {
    if (filter !== "all" && !searchTerm) return new Set(nodes.filter((n) => n.kind === filter).map((n) => n.id));
    if (searchTerm) return matches;
    return null;
  }, [nodes, filter, searchTerm, matches]);

  const pos = useMemo(() => {
    const m = new Map<string, GNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const isDimmed = (n: GNode) =>
    (filter !== "all" && n.kind !== filter) ||
    (searchTerm && !matches.has(n.id));

  const W = 900;
  const H = 560;
  const bg = theme === "dark" ? "#0B1220" : "#F1F5F9";
  const bgGrid = theme === "dark" ? "#1E293B" : "#E2E8F0";

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setView((v) => ({
      ...v,
      scale: Math.min(3, Math.max(0.3, v.scale * factor)),
    }));
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.target !== svgRef.current) return;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    dragRef.current.moved = true;
    setView((v) => ({
      ...v,
      tx: v.tx + (e.clientX - dragRef.current!.x),
      ty: v.ty + (e.clientY - dragRef.current!.y),
    }));
    dragRef.current = { x: e.clientX, y: e.clientY, moved: true };
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function resetView() {
    setView({ scale: 1, tx: 0, ty: 0 });
  }

  const visibleEdges = useMemo(
    () =>
      edges.filter((ed) => {
        const a = pos.get(ed.source);
        const b = pos.get(ed.target);
        if (!a || !b) return false;
        if (visible && (!visible.has(a.id) || !visible.has(b.id))) return false;
        return !(isDimmed(a) || isDimmed(b));
      }),
    [edges, pos, visible]
  );

  const visibleNodes = useMemo(
    () => nodes.filter((n) => (visible ? visible.has(n.id) : !isDimmed(n))),
    [nodes, visible, searchTerm, filter, matches]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge graph</h1>
          <p className="mt-1 text-sm text-hex-muted-light dark:text-hex-muted">
            Memories · types · tags — scroll to zoom, drag to pan, click a node to inspect
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input max-w-[180px]"
            placeholder="Filter nodes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(["all", "memory", "type", "tag"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={filter === f ? "btn-primary" : "btn-ghost"}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card h-20 p-5">
              <div className="skeleton h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error} — start API with <code>npm run api</code> and add some memories.
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Memories" value={stats.memories} />
            <StatCard label="Types" value={stats.types} />
            <StatCard label="Tags" value={stats.tags} />
            <StatCard label="Edges" value={stats.edges} />
          </div>

          <div className="card relative overflow-hidden p-2">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="h-[min(70vh,560px)] w-full cursor-grab touch-none active:cursor-grabbing"
              role="img"
              aria-label="Knowledge graph"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <rect width={W} height={H} fill={bg} rx="12" />
              <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
                {Array.from({ length: Math.floor(W / 50) }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={H} stroke={bgGrid} strokeWidth={0.5} />
                ))}
                {Array.from({ length: Math.floor(H / 50) }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * 50} x2={W} y2={i * 50} stroke={bgGrid} strokeWidth={0.5} />
                ))}
                {visibleEdges.map((e, i) => {
                  const a = pos.get(e.source);
                  const b = pos.get(e.target);
                  if (!a || !b) return null;
                  const stroke =
                    e.kind === "has-type"
                      ? "#A78BFA55"
                      : e.kind === "has-tag"
                        ? "#4ADE8055"
                        : "#64748B44";
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={stroke}
                      strokeWidth={e.kind === "related" ? 0.8 : 1.4}
                    />
                  );
                })}
                {visibleNodes.map((n) => {
                  const r = 6 + Math.min(n.size, 12) * 0.4;
                  const fill = KIND_COLOR[n.kind] || "#94A3B8";
                  const dimmed = isDimmed(n);
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x},${n.y})`}
                      className="cursor-pointer"
                      onClick={() => {
                        if (!dragRef.current?.moved) setSelected(n);
                      }}
                    >
                      <circle
                        r={r + 3}
                        fill="transparent"
                        stroke="transparent"
                        strokeWidth={6}
                        className="pointer-events-none"
                      />
                      <circle
                        r={r}
                        fill={fill}
                        opacity={dimmed ? 0.12 : 0.9}
                        stroke={selected?.id === n.id ? (theme === "dark" ? "#F8FAFC" : "#0F172A") : "transparent"}
                        strokeWidth={2}
                      />
                      {(n.kind !== "memory" || selected?.id === n.id || searchTerm) && (
                        <text
                          y={r + 12}
                          textAnchor="middle"
                          fill={theme === "dark" ? "#94A3B8" : "#475569"}
                          fontSize={9}
                          className="select-none"
                        >
                          {n.label.slice(0, 18)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
            <div className="pointer-events-none absolute right-4 top-4 flex flex-col gap-1">
              <button
                type="button"
                className="btn-ghost pointer-events-auto px-2 py-1 text-xs"
                onClick={resetView}
              >
                reset
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-hex-muted-light dark:text-hex-muted">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> memory
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-violet-400" /> type
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-400" /> tag
            </span>
            <span className="ml-auto hidden sm:inline">
              {visibleNodes.length}/{nodes.length} nodes · {visibleEdges.length} edges
            </span>
          </div>

          <AnimatePresence>
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="card p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-hex-muted">{selected.kind}</p>
                    <p className="mt-1 font-medium">{selected.label}</p>
                    {selected.memoryType && (
                      <p className="mt-1 text-hex-muted-light dark:text-hex-muted">
                        type: {selected.memoryType}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-xs text-hex-muted">{selected.id}</p>
                  </div>
                  <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setSelected(null)}>
                    close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
