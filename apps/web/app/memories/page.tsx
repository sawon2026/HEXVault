"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { addMemory, deleteMemory, fetchMemories, type Memory } from "@/lib/api";

const TYPES = ["note", "decision", "bugfix", "architecture", "security", "pattern", "api", "refactor", "conversation"];

export default function MemoriesPage() {
  return (
    <Suspense fallback={<div className="skeleton h-24 w-full" />}>
      <MemoriesContent />
    </Suspense>
  );
}

function MemoriesContent() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const [items, setItems] = useState<Memory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("note");
  const [importance, setImportance] = useState("0.8");
  const [ttlDays, setTtlDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const focusRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMemories(100);
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (focusId) {
      setTimeout(() => {
        focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [focusId, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      await addMemory({
        title: title || content.slice(0, 60),
        content,
        type,
        importance: Number(importance) || undefined,
        ttlDays: ttlDays ? Number(ttlDays) : undefined,
      });
      setTitle("");
      setContent("");
      setTtlDays("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteMemory(id);
      setItems((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Memories</h1>
        <p className="mt-1 text-sm text-hex-muted-light dark:text-hex-muted">
          Browse, add, and manage project memories
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-3 p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-hex-muted-light dark:text-hex-muted">
          <Plus className="h-4 w-4" /> Add memory
        </h2>
        <input
          className="input"
          placeholder="Title (optional — defaults to first 60 chars of content)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="input min-h-[88px]"
          placeholder="Content…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
        <div className="flex flex-wrap items-center gap-3">
          <select className="input max-w-[170px]" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-hex-muted-light dark:text-hex-muted">
            importance
            <input
              className="input max-w-[84px]"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={importance}
              onChange={(e) => setImportance(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-hex-muted-light dark:text-hex-muted">
            ttl (days, optional)
            <input
              className="input max-w-[84px]"
              type="number"
              min={1}
              value={ttlDays}
              onChange={(e) => setTtlDays(e.target.value)}
              placeholder="∞"
            />
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Add"}
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-4 w-1/4" />
              <div className="skeleton mt-3 h-3 w-full" />
              <div className="skeleton mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map((m) => (
              <motion.li
                key={m.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  ref={m.id === focusId ? focusRef : undefined}
                  className={
                    m.id === focusId
                      ? "card border-cyan-500/50 p-4 ring-1 ring-cyan-500/30"
                      : "card p-4"
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge bg-violet-500/15 text-violet-500 dark:text-violet-300">{m.type}</span>
                    <span className="text-xs text-hex-muted-light dark:text-hex-muted">{m.createdAt?.slice?.(0, 10)}</span>
                    <span className="badge bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                      {typeof m.importance === "number" ? m.importance.toFixed(2) : "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="btn-ghost ml-auto px-2 py-1 text-red-400 hover:bg-red-500/10"
                      aria-label="Delete memory"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <h3 className="mt-2 font-medium">{m.title}</h3>
                  <p className="mt-1 text-sm text-hex-muted-light line-clamp-3 dark:text-hex-muted">{m.content}</p>
                  {m.tags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.tags.map((t) => (
                        <span key={t} className="badge bg-slate-500/10 text-hex-muted">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
          {!items.length && !loading && (
            <li className="card py-12 text-center text-sm text-hex-muted">No memories yet.</li>
          )}
        </ul>
      )}
    </div>
  );
}
