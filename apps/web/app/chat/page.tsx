"use client";
import { useState } from "react";
import { chat } from "@/lib/api";

type Msg = { role: "user" | "assistant"; text: string };

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await chat(q);
      const sources = res.sources?.length
        ? "\n\n—\nSources: " + res.sources.map((s: { title: string }) => s.title).join(", ")
        : "";
      setMsgs((m) => [...m, { role: "assistant", text: res.answer + sources }]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: err instanceof Error ? err.message : "Chat failed" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Repo chat</h1>
        <p className="mt-1 text-sm text-hex-muted">RAG over project memories</p>
      </div>
      <div className="card flex min-h-[360px] flex-col p-4">
        <div className="flex-1 space-y-3 overflow-y-auto">
          {msgs.length === 0 && (
            <p className="py-16 text-center text-sm text-hex-muted">Ask e.g. “What database did we choose?”</p>
          )}
          {msgs.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "ml-8 rounded-2xl bg-cyan-500/15 px-4 py-2 text-sm"
                  : "mr-8 rounded-2xl bg-slate-800/80 px-4 py-2 text-sm whitespace-pre-wrap"
              }
            >
              {m.text}
            </div>
          ))}
          {loading && <p className="text-xs text-hex-muted">Thinking…</p>}
        </div>
        <form onSubmit={send} className="mt-4 flex gap-2 border-t border-hex-border pt-4">
          <input className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask…" disabled={loading} />
          <button type="submit" className="btn-primary" disabled={loading}>Send</button>
        </form>
      </div>
    </div>
  );
}
