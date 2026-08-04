"use client";
import { useEffect, useState } from "react";
import { addMemory, fetchMemories, type Memory } from "@/lib/api";

export default function MemoriesPage() {
  const [items, setItems] = useState<Memory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("note");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMemories(100);
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      await addMemory({ title: title || content.slice(0, 60), content, type });
      setTitle("");
      setContent("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Memories</h1>
        <p className="mt-1 text-sm text-hex-muted">Browse and add project memories</p>
      </div>
      <form onSubmit={onSubmit} className="card space-y-3 p-5">
        <input className="input" placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input min-h-[88px]" placeholder="Content…" value={content} onChange={(e) => setContent(e.target.value)} required />
        <div className="flex flex-wrap gap-3">
          <select className="input max-w-[180px]" value={type} onChange={(e) => setType(e.target.value)}>
            {["note", "decision", "bugfix", "architecture", "security", "pattern", "api", "refactor"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Add"}</button>
        </div>
      </form>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {loading ? <p className="text-sm text-hex-muted">Loading…</p> : (
        <ul className="space-y-3">
          {items.map((m) => (
            <li key={m.id} className="card p-4">
              <span className="badge bg-violet-500/15 text-violet-300">{m.type}</span>
              <h3 className="mt-2 font-medium">{m.title}</h3>
              <p className="mt-1 text-sm text-hex-muted line-clamp-3">{m.content}</p>
            </li>
          ))}
          {!items.length && <li className="py-10 text-center text-sm text-hex-muted">No memories yet.</li>}
        </ul>
      )}
    </div>
  );
}
