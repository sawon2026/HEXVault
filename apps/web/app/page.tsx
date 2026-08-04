import { StatCard } from "@/components/StatCard";
import { fetchAnalytics, fetchHealth, fetchMemories } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  let health = { ok: false as boolean, version?: string };
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
        <p className="mt-1 text-sm text-hex-muted">Project memory health and recent activity</p>
      </div>

      {!health.ok && (
        <div className="card border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          <p className="font-medium">API offline</p>
          <p className="mt-1 text-amber-200/80">Start: <code>npm run api</code> → :3850</p>
          {apiError ? <p className="mt-2 text-xs opacity-70">{apiError}</p> : null}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="API" value={health.ok ? "Online" : "Offline"} hint={health.version ? `v${health.version}` : "port 3850"} />
        <StatCard label="Memories" value={stats.total} />
        <StatCard label="Types" value={Object.keys(stats.byType).length || "—"} />
        <StatCard label="Links" value="→" hint="Search · Chat · Analyze" />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Recent memories</h2>
          <Link href="/memories" className="text-sm text-cyan-400 hover:underline">View all</Link>
        </div>
        <ul className="mt-4 divide-y divide-hex-border">
          {recent.length === 0 && (
            <li className="py-6 text-center text-sm text-hex-muted">No memories yet.</li>
          )}
          {recent.map((m) => (
            <li key={m.id} className="flex justify-between gap-4 py-3">
              <div>
                <span className="badge bg-violet-500/15 text-violet-300">{m.type}</span>
                <p className="mt-1 font-medium">{m.title}</p>
              </div>
              <time className="text-xs text-slate-500">{m.createdAt?.slice?.(0, 10) || ""}</time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
