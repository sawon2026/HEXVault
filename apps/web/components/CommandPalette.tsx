"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Search, MessageSquare, GitBranch, LayoutGrid, Settings, Sun, Moon, Database, Plus } from "lucide-react";
import { searchMemories, fetchMemories } from "@/lib/api";
import { useTheme } from "./ThemeProvider";

const COMMANDS: { id: string; label: string; hint: string; icon: React.ReactNode; href?: string; action?: "theme" }[] = [
  { id: "overview", label: "Go to Overview", hint: "g o", icon: <LayoutGrid className="h-4 w-4" />, href: "/" },
  { id: "memories", label: "Go to Memories", hint: "g m", icon: <Database className="h-4 w-4" />, href: "/memories" },
  { id: "search", label: "Go to Search", hint: "g s", icon: <Search className="h-4 w-4" />, href: "/search" },
  { id: "chat", label: "Go to Repository Chat", hint: "g c", icon: <MessageSquare className="h-4 w-4" />, href: "/chat" },
  { id: "timeline", label: "Go to Timeline", hint: "g t", icon: <FileText className="h-4 w-4" />, href: "/timeline" },
  { id: "graph", label: "Go to Knowledge Graph", hint: "g g", icon: <GitBranch className="h-4 w-4" />, href: "/graph" },
  { id: "settings", label: "Go to Settings", hint: "g ,", icon: <Settings className="h-4 w-4" />, href: "/settings" },
  { id: "theme", label: "Toggle light / dark mode", hint: "t", icon: <Sun className="h-4 w-4" />, action: "theme" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { toggle } = useTheme();
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<{ id: string; title: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
      fetchMemories(12)
        .then((r) => setMemories(r.items.map((m) => ({ id: m.id, title: m.title }))))
        .catch(() => setMemories([]));
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q) || c.hint.includes(q));
  }, [query]);

  const memoryMatches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return memories.slice(0, 5);
    return memories.filter((m) => m.title.toLowerCase().includes(q)).slice(0, 5);
  }, [query, memories]);

  const run = (id: string) => {
    onClose();
    if (id === "theme") {
      toggle();
      return;
    }
    const cmd = COMMANDS.find((c) => c.id === id);
    if (cmd?.href) router.push(cmd.href);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-hex-border-light bg-white shadow-2xl dark:border-hex-border dark:bg-hex-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-hex-border-light px-4 py-3 dark:border-hex-border">
              <Search className="h-4 w-4 text-hex-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands or memories…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                  if (e.key === "Enter" && filtered[0]) run(filtered[0].id);
                }}
              />
              <kbd className="kbd">esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => run(c.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-cyan-500/10"
                >
                  <span className="text-hex-muted">{c.icon}</span>
                  <span className="flex-1">{c.label}</span>
                  <kbd className="kbd">{c.hint}</kbd>
                </button>
              ))}
              {memoryMatches.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-hex-muted">
                    Memories
                  </p>
                  {memoryMatches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/memories?focus=${encodeURIComponent(m.id)}`);
                      }}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-cyan-500/10"
                    >
                      <Plus className="h-4 w-4 text-hex-muted" />
                      <span className="truncate">{m.title}</span>
                    </button>
                  ))}
                </>
              )}
              {query && filtered.length === 0 && memoryMatches.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-hex-muted">No results for “{query}”</p>
              )}
            </div>
            <div className="flex items-center gap-4 border-t border-hex-border-light px-4 py-2 text-[10px] text-hex-muted dark:border-hex-border">
              <span className="flex items-center gap-1"><kbd className="kbd">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="kbd">↵</kbd> select</span>
              <span className="flex items-center gap-1"><Moon className="h-3 w-3" /> toggle theme</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
