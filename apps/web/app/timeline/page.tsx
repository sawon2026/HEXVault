"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { fetchTimeline } from "@/lib/api";
import { StatCard } from "@/components/StatCard";

type TimelineItem = { date: string; count: number; types: Record<string, number> };

const TYPE_COLOR: Record<string, string> = {
  decision: "#A78BFA",
  bugfix: "#F87171",
  architecture: "#38BDF8",
  pattern: "#4ADE80",
  security: "#FB923C",
  note: "#94A3B8",
  api: "#F472B6",
  refactor: "#FBBF24",
  conversation: "#818CF8",
};

export default function TimelinePage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeline()
      .then((r) => setItems(r.items || []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load timeline"))
      .finally(() => setLoading(false));
  }, []);

  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Memory timeline</h1>
          <p className="mt-1 text-sm text-hex-muted-light dark:text-hex-muted">
            Memories created per day — {total} total across {items.length} days
          </p>
        </div>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-24 p-5">
              <div className="skeleton h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error} — start API with <code>npm run api</code>.
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <CalendarDays className="h-10 w-10 text-hex-muted" />
          <p className="text-sm text-hex-muted-light dark:text-hex-muted">
            No memories yet. Add your first one to see activity here.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          <StatCard label="Days with activity" value={items.length} />
          <StatCard label="Total memories" value={total} />
          <StatCard label="Avg per day" value={(total / items.length).toFixed(1)} />
        </motion.div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="card overflow-x-auto p-6">
          <div className="flex h-40 items-end gap-1.5">
            {items.map((item) => (
              <motion.div
                key={item.date}
                initial={{ height: 0 }}
                animate={{ height: `${(item.count / max) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="group relative flex flex-1 items-end"
                title={`${item.date}: ${item.count}`}
              >
                <div className="w-full rounded-t-md bg-gradient-to-t from-cyan-600 to-cyan-400 opacity-80 transition hover:opacity-100 dark:from-cyan-900 dark:to-cyan-500" />
                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100 dark:bg-white dark:text-slate-900">
                  {item.date} · {item.count}
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-3 flex justify-between text-[10px] text-hex-muted">
            <span>{items[0]?.date}</span>
            <span>{items[items.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="relative space-y-4 pl-6">
          <div className="absolute bottom-0 left-[7px] top-0 w-px bg-hex-border-light dark:bg-hex-border" />
          {[...items].reverse().map((item, i) => (
            <motion.div
              key={item.date}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative"
            >
              <span className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-cyan-500 bg-white dark:bg-hex-bg" />
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{item.date}</p>
                  <span className="badge bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">{item.count}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(item.types).map(([type, count]) => (
                    <span key={type} className="badge" style={{ backgroundColor: `${TYPE_COLOR[type] || "#94A3B8"}22`, color: TYPE_COLOR[type] || "#94A3B8" }}>
                      {type}: {count}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
