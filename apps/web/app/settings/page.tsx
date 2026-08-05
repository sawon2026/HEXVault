"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { fetchHealth, fetchMemoryHealth, webhookTest } from "@/lib/api";

type Providers = Record<string, { configured: boolean; env: string }>;

export default function SettingsPage() {
  const [health, setHealth] = useState<{
    ok: boolean;
    version?: string;
    uptimeSec?: number;
    node?: string;
    providers?: Providers;
    webhooks?: number;
  } | null>(null);
  const [memoryHealth, setMemoryHealth] = useState<{
    ok: boolean;
    total: number;
    importanceAvg: number;
    warnings: string[];
    recommendations: string[];
  } | null>(null);
  const [webhookMsg, setWebhookMsg] = useState("");
  const [webhookResult, setWebhookResult] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchHealth().then(setHealth).catch(() => setHealth({ ok: false }));
    fetchMemoryHealth().then(setMemoryHealth).catch(() => null);
  }, []);

  useEffect(load, [load]);

  const testWebhook = async () => {
    try {
      const r = await webhookTest(webhookMsg || "HEXVault settings test");
      setWebhookResult(r.delivered > 0 ? `Delivered to ${r.delivered} endpoint(s)` : "No endpoints configured");
    } catch (e) {
      setWebhookResult(e instanceof Error ? e.message : "Webhook test failed");
    }
  };

  const uptime = health?.uptimeSec ? Math.floor(health.uptimeSec / 60) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-hex-muted-light dark:text-hex-muted">
          Service health, LLM providers, and webhook delivery
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Service status */}
        <section className="card p-6">
          <h2 className="flex items-center gap-2 font-medium">
            <Activity className="h-4 w-4 text-cyan-500" /> API service
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-hex-muted">Status</p>
              <p className={`mt-1 flex items-center gap-1.5 font-medium ${health?.ok ? "text-emerald-500" : "text-red-400"}`}>
                {health?.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {health?.ok ? "Online" : "Offline"}
              </p>
            </div>
            <div>
              <p className="text-xs text-hex-muted">Version</p>
              <p className="mt-1 font-medium">{health?.version || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-hex-muted">Uptime</p>
              <p className="mt-1 font-medium">{uptime > 0 ? `${uptime}m` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-hex-muted">Node.js</p>
              <p className="mt-1 font-medium">{health?.node || "—"}</p>
            </div>
          </div>
        </section>

        {/* Memory health */}
        <section className="card p-6">
          <h2 className="font-medium">Memory health</h2>
          {memoryHealth ? (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-hex-muted">Memories</p>
                  <p className="mt-1 text-xl font-semibold">{memoryHealth.total}</p>
                </div>
                <div>
                  <p className="text-xs text-hex-muted">Avg importance</p>
                  <p className="mt-1 text-xl font-semibold">{memoryHealth.importanceAvg.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-hex-muted">Status</p>
                  <p className={`mt-1 text-xl font-semibold ${memoryHealth.ok ? "text-emerald-500" : "text-amber-500"}`}>
                    {memoryHealth.ok ? "Healthy" : "Needs attention"}
                  </p>
                </div>
              </div>
              {memoryHealth.warnings.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {memoryHealth.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-500">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              )}
              {memoryHealth.recommendations.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {memoryHealth.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-hex-muted">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" /> {r}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-hex-muted">API offline — start it to see health data.</p>
          )}
        </section>

        {/* Providers */}
        <section className="card p-6">
          <h2 className="font-medium">LLM providers</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(health?.providers || {}).map(([name, p]) => (
              <div key={name} className="flex items-center justify-between rounded-xl border border-hex-border-light px-3 py-2.5 dark:border-hex-border">
                <span className="text-sm capitalize">{name}</span>
                <span className={`badge ${p.configured ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-hex-muted"}`}>
                  {p.configured ? "configured" : "missing key"}
                </span>
              </div>
            ))}
            {!health?.providers && <p className="text-sm text-hex-muted">API offline</p>}
          </div>
        </section>

        {/* Webhooks */}
        <section className="card p-6">
          <h2 className="font-medium">Webhooks</h2>
          <p className="mt-1 text-sm text-hex-muted-light dark:text-hex-muted">
            Configured endpoints: {health?.webhooks ?? 0} (from HEXVAULT_WEBHOOK_URLS)
          </p>
          <div className="mt-4 flex gap-2">
            <input
              className="input max-w-md"
              placeholder="Test message (optional)"
              value={webhookMsg}
              onChange={(e) => setWebhookMsg(e.target.value)}
            />
            <button type="button" className="btn-primary" onClick={testWebhook}>
              Send test
            </button>
          </div>
          {webhookResult && <p className="mt-3 text-sm text-cyan-500">{webhookResult}</p>}
        </section>
      </motion.div>
    </div>
  );
}
