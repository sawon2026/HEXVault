import { StatCard } from "@/components/StatCard";
import { fetchAnalytics, fetchHealth, fetchMemories } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let health: { ok: boolean; version?: string } = { ok: false };
  let stats = { total: 0, byType: {} as Record<string, number> };
  let recent: { id: string; type: string; title: string; createdAt: string }[] = [];
  let apiError: string | null = null;

  try {
    health = await fetchHealth();
    if (health.ok) {
      const [analytics, mems] = await Promise.all([
        fetchAnalytics().catch(() => ({ total: 0 })),
        fetchMemories(8),
      ]);
      stats = {
        total: (analytics as { total?: number }).total ?? mems.count,
        byType: (analytics as { byType?: Record<string, number> }).byType || {},
      };
      recent = mems.items;
    }
  } catch (e) {
    apiError = e instanceof Error ? e.message : "API unreachable";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-hex-muted">
          Project memory health and recent activity
        </p>
      </div>

      {!health.ok && (
        <div className="card border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-200">
          <p className="font-medium">API offline</p>
          <p className="mt-1 opacity-80">
            Start the HEXVault API in another terminal:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-500/10 p-3 text-xs text-hex-muted-light dark:bg-black/40 dark:text-slate-300">
            npm run api{"\n"}# → http://127.0.0.1:3850
          </pre>
          {apiError ? <p className="mt-2 text-xs opacity-70">{apiError}</p> : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="API"
          value={health.ok ? "Online" : "Offline"}
          hint={health.version ? `v${health.version}` : "port 3850"}
        />
        <StatCard label="Memories" value={stats.total} />
        <StatCard
          label="Types"
          value={Object.keys(stats.byType).length || "—"}
        />
        <StatCard
          label="Quick links"
          value="→"
          hint="Search · Chat · Analyze"
        />
      </div>

      {Object.keys(stats.byType).length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-hex-muted">By type</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(stats.byType).map(([type, n]) => (
              <span
                key={type}
                className="badge bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"
              >
                {type}: {n}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Recent memories</h2>
          <Link href="/memories" className="text-sm text-cyan-600 hover:underline dark:text-cyan-400">
            View all
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-hex-border-light dark:divide-hex-border">
          {recent.length === 0 && (
            <li className="py-6 text-center text-sm text-hex-muted">
              No memories yet. Use CLI <code className="text-cyan-600 dark:text-cyan-400">hexvault add</code> or{" "}
              <Link href="/memories" className="text-cyan-600 hover:underline dark:text-cyan-400">
                Memories
              </Link>
              .
            </li>
          )}
          {recent.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <span className="badge bg-violet-500/15 text-violet-500 dark:text-violet-300">{m.type}</span>
                <p className="mt-1 font-medium">{m.title}</p>
              </div>
              <time className="shrink-0 text-xs text-hex-muted-light dark:text-hex-muted">
                {m.createdAt?.slice?.(0, 10) || ""}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
