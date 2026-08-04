"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/memories", label: "Memories" },
  { href: "/search", label: "Search" },
  { href: "/chat", label: "Chat" },
  { href: "/analyze", label: "Analyze" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-hex-border/80 bg-hex-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">H</span>
            <span>HEX<span className="text-cyan-400">Vault</span></span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm transition",
                    active ? "bg-cyan-500/15 text-cyan-300" : "text-hex-muted hover:bg-white/5 hover:text-hex-text"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-hex-border/60 py-6 text-center text-xs text-hex-muted">
        HEXVault Dashboard · API :3850
      </footer>
    </div>
  );
}
