/**
 * Simple self-hosted web dashboard for HEXVault
 * Run: npx tsx src/dashboard/server.ts
 */
import http from "http";
import fs from "fs";
import path from "path";
import { MemoryStore } from "../core/memory/store.js";
import { loadConfig } from "../config/index.js";
import { FeedbackStore } from "../core/feedback/learning.js";

const PORT = parseInt(process.env.HEXVAULT_DASHBOARD_PORT || "3847", 10);

function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · HEXVault</title>
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8; --green: #4ade80; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--text); }
    header { padding: 1.5rem 2rem; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 1rem; }
    header h1 { margin: 0; font-size: 1.4rem; }
    header span { color: var(--muted); font-size: 0.9rem; }
    main { padding: 2rem; max-width: 1100px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: var(--card); border-radius: 12px; padding: 1.25rem; border: 1px solid #334155; }
    .card h3 { margin: 0 0 0.4rem; font-size: 0.85rem; color: var(--muted); font-weight: 500; }
    .card .num { font-size: 1.8rem; font-weight: 700; color: var(--accent); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #334155; }
    th { color: var(--muted); font-size: 0.8rem; font-weight: 500; }
    .tag { display: inline-block; background: #334155; padding: 0.15rem 0.5rem; border-radius: 6px; font-size: 0.75rem; margin-right: 0.3rem; }
    .type-decision { color: #a78bfa; }
    .type-bugfix { color: #f87171; }
    .type-security { color: #fb923c; }
    .type-architecture { color: #38bdf8; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <header>
    <h1>🧠 HEXVault</h1>
    <span>Project Memory Dashboard</span>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function startDashboard() {
  const config = loadConfig();
  const dbPath = path.resolve(config.memory.path);
  const feedbackPath = path.resolve(".hexvault/feedback.db");

  const server = http.createServer((req, res) => {
    try {
      const store = new MemoryStore({ dbPath });
      const feedback = fs.existsSync(path.dirname(feedbackPath))
        ? new FeedbackStore(feedbackPath)
        : null;

      const stats = store.stats();
      const memories = store.list(50);
      const fbStats = feedback?.stats() || { up: 0, down: 0, total: 0 };

      store.close();
      feedback?.close();

      const statsHtml = `
        <div class="grid">
          <div class="card"><h3>Total Memories</h3><div class="num">${stats.total}</div></div>
          <div class="card"><h3>Feedback Up</h3><div class="num" style="color:var(--green)">${fbStats.up}</div></div>
          <div class="card"><h3>Feedback Down</h3><div class="num" style="color:#f87171">${fbStats.down}</div></div>
          <div class="card"><h3>Types</h3><div class="num">${Object.keys(stats.byType).length}</div></div>
        </div>
        <div class="card">
          <h3 style="margin-bottom:1rem">Recent Memories</h3>
          <table>
            <thead><tr><th>Type</th><th>Title</th><th>Tags</th><th>Date</th></tr></thead>
            <tbody>
              ${memories
                .map(
                  (m) => `<tr>
                  <td class="type-${m.type}">${m.type}</td>
                  <td>${escapeHtml(m.title)}</td>
                  <td>${m.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</td>
                  <td>${m.createdAt.slice(0, 10)}</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlPage("Dashboard", statsHtml));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Error: " + err.message);
    }
  });

  server.listen(PORT, () => {
    console.log(`HEXVault Dashboard → http://localhost:${PORT}`);
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

startDashboard();
