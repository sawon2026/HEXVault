<p align="center">
  <img src="assets/hexvault-banner.svg" alt="HEXVault" width="100%" />
</p>

<p align="center">
  <strong>Intelligent Project Memory Vault + Smart PR Reviewer</strong><br/>
  Your project remembers everything. Every PR gets smarter.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/version-3.0.0-blue.svg" alt="Version" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-22.5%2B-green.svg" alt="Node" /></a>
  <a href=".github/workflows/hexvault-review.yml"><img src="https://img.shields.io/badge/GitHub-Action-black.svg" alt="Action" /></a>
  <img src="https://img.shields.io/badge/API-REST%20%2B%20GraphQL-cyan.svg" alt="API" />
  <img src="https://img.shields.io/badge/Webhooks-HMAC--SHA256-red.svg" alt="Webhooks" />
  <img src="https://img.shields.io/badge/SDKs-TS%20%2F%20Go%20%2F%20Python-orange.svg" alt="SDKs" />
</p>

---

## Why HEXVault?

Most AI coding tools forget everything between sessions.  
Most PR reviewers have **zero knowledge** of your past decisions, bug fixes, or architecture choices.

**HEXVault fixes both.**

| Capability | What you get |
|------------|----------------|
| **Project Memory Vault** | Decisions, bug fixes, architecture notes, patterns & security rules — stored locally in SQLite (TTL, importance, auto-tags, links) |
| **Hybrid Search** | Keyword + semantic ranking over persisted embeddings |
| **RAG Chat** | Ask questions, get grounded answers with citations (`/v1/chat`, `hexvault ask`, dashboard) |
| **Smart PR Reviewer** | Context-aware reviews powered by your project memory + optional LLM |
| **GitHub Action** | Automatic review comments on every pull request |
| **Multi-model LLMs** | OpenAI · Anthropic · Grok · Gemini · OpenRouter · Groq · Mistral · DeepSeek · Azure · Ollama · LM Studio |
| **Knowledge Graph** | Interactive graph of memories, types & tags (zoom/pan/search) |
| **Webhooks & Notify** | HMAC-signed webhooks; Slack / Discord / Teams / Notion / Jira / Linear |
| **Team sync** | Export/import vault bundles · multi-repo linking |
| **Dashboards** | Next.js dashboard (light/dark, ⌘K palette) + legacy self-hosted UI |
| **SDKs** | TypeScript · Go · Python |

**No API key required** — every AI feature has a deterministic rule-based
fallback, so the platform works out of the box and gets smarter when you add
keys (`hexvault providers` shows what's configured).

---

## Quick Start

```bash
# Install
npm install          # Node ≥ 22.5 recommended (built-in sqlite, no native builds)

# Initialize in any project
npx hexvault init

# Add your first memories
npx hexvault add "We use SQLite and never hardcode secrets" --type decision --tags security
npx hexvault add "Auth middleware must validate JWT expiry" --type architecture --files src/auth

# Search
npx hexvault search "auth"

# Ask the project itself
npx hexvault ask "Which database did we choose?"

# Start the REST API (+ GraphQL) and the dashboard
npm run api          # → http://127.0.0.1:3850  (REST + GraphQL)
npm run web          # → http://localhost:3000  (dashboard)
```

### Docker

```bash
docker compose up --build
# API  → http://localhost:3850
# Web  → http://localhost:3000
```

---

## Feature Matrix

| Feature | Status |
|---------|--------|
| Memory engine v3 (importance, TTL, categories, links, auto-tags) | ✅ |
| Schema auto-migration (v1 → v2 in place) | ✅ |
| Hybrid search (keyword + persisted embeddings) | ✅ |
| RAG chat with citations & conversation threads | ✅ |
| Smart PR Reviewer (rule + AI) · GitHub Action | ✅ |
| 11 LLM providers with retries + rule fallback | ✅ |
| Azure OpenAI · streaming SSE · timeouts | ✅ |
| REST API + GraphQL (full CRUD, analytics, timeline, health) | ✅ |
| Next.js dashboard (light/dark, ⌘K palette, graph zoom/pan) | ✅ |
| Knowledge graph (memories · types · tags) | ✅ |
| Webhooks (HMAC-SHA256, retries, event filters) | ✅ |
| Slack / Discord / Teams / Notion / Jira / Linear notify | ✅ |
| Sync export/import bundles · multi-repo linking | ✅ |
| CLI (30+ commands) + interactive TUI | ✅ |
| SDKs (TS + Python + Go) | ✅ |
| GitLab + Bitbucket providers | ✅ |
| Docker (API + dashboard), hardened CI (lint/format/typecheck/tests) | ✅ |
| Unit tests (63) | ✅ |

---

## Docs

| Guide | Where |
|-------|-------|
| Setup walkthrough | [docs/guides/SETUP.md](docs/guides/SETUP.md) |
| Architecture (v3) | [docs/architecture/overview.md](docs/architecture/overview.md) |
| REST + GraphQL API reference | [docs/api/REST.md](docs/api/REST.md) |
| CLI reference | [docs/CLI.md](docs/CLI.md) |
| Environment variables | [docs/guides/ENVIRONMENT.md](docs/guides/ENVIRONMENT.md) |
| FAQ | [docs/guides/FAQ.md](docs/guides/FAQ.md) |
| Troubleshooting | [docs/guides/TROUBLESHOOTING.md](docs/guides/TROUBLESHOOTING.md) |
| Migrating to v3 | [docs/guides/MIGRATION.md](docs/guides/MIGRATION.md) |
| 14-phase status | [docs/PHASES.md](docs/PHASES.md) |

---

## Configuration

Create `.hexvault.yml` (auto-generated by `init`):

```yaml
memory:
  path: .hexvault/memory.db
  vector: true
  defaultTtlDays: 0          # per-memory TTL overrides this
  dedupThreshold: 0.92

review:
  model: rule-based          # rule-based | openai | anthropic | grok | ollama | ...
  severity: medium
  checks: [security, consistency, best-practices]

llm:
  priority: [openai, anthropic, ollama]   # tried in order, with retries
  maxRetries: 2
  temperature: 0.3

notifications:
  enabled: false
  channel: discord           # slack | discord | teams | notion | jira | linear | webhook
  webhookUrlEnv: HEXVAULT_WEBHOOK_URL

webhooks:
  enabled: false
  events: [memory.added, review.completed, sync.imported]

multiRepo:
  enabled: false
  configPath: .hexvault/multi-repo.json

ignore: ["**/*.test.ts", "docs/**", "node_modules/**"]
```

**Environment variables** — full reference in
[docs/guides/ENVIRONMENT.md](docs/guides/ENVIRONMENT.md). Highlights:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `XAI_API_KEY` / `GEMINI_API_KEY` | Cloud LLM keys |
| `OLLAMA_HOST` / `LMSTUDIO_HOST` | Local models (defaults: localhost:11434 / 1234) |
| `HEXVAULT_API_PORT` / `HEXVAULT_API_HOST` / `HEXVAULT_API_TOKEN` | API binding + auth |
| `HEXVAULT_WEBHOOK_URLS` (+ `_EVENTS`, `_SECRET`) | Signed webhook delivery |
| `HEXVAULT_API_URL` | Dashboard → API base (SSR) |

---

## GitHub Action

Workflow is included — it runs on `pull_request`
(opened / synchronize / reopened) and posts a context-aware review comment:

```
.github/workflows/hexvault-review.yml
```

---

## Architecture

See **[docs/architecture/overview.md](docs/architecture/overview.md)** for the
v3 module map, data flow, storage design, and extensibility points.

```
src/
├── core/
│   ├── db/               # SQLite adapter (node:sqlite, better-sqlite3 fallback)
│   ├── memory/           # Store (schema v2) + Engine (rank, dedup, TTL, links)
│   ├── llm/              # 11 providers · registry · retries
│   ├── vector/           # Embeddings (local / OpenAI / Ollama)
│   ├── ai/               # Features + repo-chat (RAG) — rule fallbacks
│   ├── review/           # Rule + AI reviewer
│   ├── ingest/ · feedback/ · sync/ · multi-repo/
│   ├── notifications/ · webhooks/ · env/ · errors/ · logging/
├── api/                  # REST + GraphQL (:3850)
├── cli/                  # CLI + TUI
├── action/               # GitHub Action entrypoint
├── dashboard/            # Legacy UI (:3847)
├── providers/            # GitHub · GitLab · Bitbucket
└── extension/            # VS Code / Cursor scaffold
apps/web/                 # Next.js dashboard (standalone build)
packages/sdk{,go,python}/ # SDKs
```

---

## Development

```bash
npm run lint          # ESLint (flat config)
npm run format:check  # Prettier
npx tsc --noEmit      # Typecheck
npm test              # Vitest (63 tests / 19 files)
npm run build         # tsc emit → dist/
npm run web:build     # Next.js standalone build
```

CI runs all four checks plus a dashboard build on Node 18/20/22
(see `.github/workflows/ci.yml`).

---

## Version History

| Version | Focus |
|---------|--------|
| **v0.1** | Foundation — Memory Vault, rule-based reviewer, CLI, GitHub Action |
| **v0.2** | Intelligence — LLM providers, embeddings, auto-ingest, AI reviews |
| **v0.3** | Scale — Multi-repo, custom rules, extension scaffold, feedback learning |
| **v0.4** | Ecosystem — Dashboard, notifications, GitLab & Bitbucket providers |
| **v1–v2** | REST API, GraphQL, SDKs, TUI, knowledge graph, analysis heuristics |
| **v3.0.0** | Enterprise hardening — node:sqlite adapter, schema v2 (importance/TTL/links/embeddings), multi-model streaming, webhooks + HMAC, chat threads, Zod-validated config, Next.js dashboard v2, Docker, hardened CI, 63 tests |

---

## Contributing

PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

1. Fork the repo
2. Create a feature branch
3. Add memories about your changes
4. Open a PR — HEXVault will review it

---

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

---

## License

MIT © [sawon2026](https://github.com/sawon2026)

---

<p align="center">
  <img src="assets/hexvault-logo.svg" width="64" height="64" alt="HEXVault logo" />
  <br/>
  <sub><b>HEXVault</b> — Because your project deserves a memory, and every PR deserves context.</sub>
</p>
