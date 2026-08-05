"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, RotateCcw, MessageSquare } from "lucide-react";
import { chat } from "@/lib/api";

type Msg = { role: "user" | "assistant"; text: string; sources?: { id: string; title: string }[] };

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await chat(q, { conversationId: conversationId ?? undefined });
      if (res.conversationId) setConversationId(res.conversationId);
      setMsgs((m) => [...m, { role: "assistant", text: res.answer, sources: res.sources }]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Chat failed — is the API running on :3850?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMsgs([]);
    setConversationId(null);
  }

  async function copy(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Repository chat</h1>
          <p className="mt-1 text-sm text-hex-muted-light dark:text-hex-muted">
            RAG over project memories
            {conversationId && <span className="ml-2 font-mono text-[10px] text-cyan-500">{conversationId.slice(0, 8)}…</span>}
          </p>
        </div>
        {msgs.length > 0 && (
          <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" onClick={reset} title="New conversation">
            <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
            New
          </button>
        )}
      </div>

      <div className="card flex min-h-[380px] flex-col p-4">
        <div className="flex-1 space-y-3 overflow-y-auto">
          {msgs.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <MessageSquare className="h-10 w-10 text-hex-muted" />
              <p className="text-sm text-hex-muted-light dark:text-hex-muted">
                Ask e.g. “What database did we choose?” — answers are grounded in memories with sources.
              </p>
            </div>
          )}
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-2xl bg-cyan-500/15 px-4 py-2 text-sm"
                    : "mr-8 rounded-2xl bg-slate-500/10 px-4 py-2 text-sm whitespace-pre-wrap dark:bg-slate-800/80"
                }
              >
                {m.text}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-hex-border-light pt-2 dark:border-hex-border">
                    {m.sources.map((s) => (
                      <span key={s.id} className="badge bg-cyan-500/10 text-cyan-600 dark:text-cyan-300" title={s.id}>
                        {s.title}
                      </span>
                    ))}
                  </div>
                )}
                {m.role === "assistant" && (
                  <button
                    type="button"
                    className="mt-2 flex items-center gap-1 text-[10px] text-hex-muted hover:text-cyan-500"
                    onClick={() => copy(i, m.text)}
                  >
                    {copied === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied === i ? "copied" : "copy"}
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-xs text-hex-muted">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500 [animation-delay:300ms]" />
              <span className="ml-2">Thinking…</span>
            </motion.div>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="mt-4 flex gap-2 border-t border-hex-border-light pt-4 dark:border-hex-border">
          <input
            className="input flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the project…"
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
