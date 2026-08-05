"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Command, LayoutGrid, Database, Search, MessageSquare, FileText, GitBranch, Settings } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { CommandPalette } from "./CommandPalette";

const NAV = [
  { href: "/", label: "Overview", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { href: "/memories", label: "Memories", icon: <Database className="h-3.5 w-3.5" /> },
  { href: "/search", label: "Search", icon: <Search className="h-3.5 w-3.5" /> },
  { href: "/chat", label: "Chat", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { href: "/timeline", label: "Timeline", icon: <FileText className="h-3.5 w-3.5" /> },
  { href: "/graph", label: "Graph", icon: <GitBranch className="h-3.5 w-3.5" /> },
  { href: "/settings", label: "Settings", icon: <Settings className="h-3.5 w-3.5" /> },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-hex-border-light/80 bg-white/80 backdrop-blur-md dark:border-hex-border/80 dark:bg-hex-bg/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <motion.span
              whileHover={{ rotate: 8 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-300"
            >
              H
            </motion.span>
            <span className="text-hex-text-light dark:text-hex-text">
              HEX<span className="text-cyan-500 dark:text-cyan-400">Vault</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition",
                    active
                      ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
                      : "text-hex-muted-light hover:bg-black/5 hover:text-hex-text-light dark:text-hex-muted dark:hover:bg-white/5 dark:hover:text-hex-text"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="btn-ghost hidden items-center gap-2 px-3 py-1.5 text-xs sm:flex"
              aria-label="Command palette"
            >
              <Command className="h-3.5 w-3.5" />
              <span className="text-hex-muted-light dark:text-hex-muted">Command</span>
              <kbd className="kbd">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={toggle}
              className="btn-ghost px-2.5 py-1.5"
              aria-label="Toggle theme"
              title="Toggle light/dark (T)"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-hex-border-light/60 px-4 py-1.5 md:hidden dark:border-hex-border/60">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition",
                  active
                    ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
                    : "text-hex-muted-light dark:text-hex-muted"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
      <footer className="border-t border-hex-border-light/60 py-6 text-center text-xs text-hex-muted-light dark:border-hex-border/60 dark:text-hex-muted">
        HEXVault Dashboard · connects to API on :3850 · press{" "}
        <kbd className="kbd">⌘K</kbd> for commands
      </footer>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
