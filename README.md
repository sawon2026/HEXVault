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
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-18%2B-green.svg" alt="Node" /></a>
  <a href=".github/workflows/hexvault-review.yml"><img src="https://img.shields.io/badge/GitHub-Action-black.svg" alt="Action" /></a>
  <img src="https://img.shields.io/badge/API-REST%20%2B%20GraphQL-cyan.svg" alt="API" />
  <img src="https://img.shields.io/badge/SDKs-TS%20%2F%20Go%20%2F%20Python-orange.svg" alt="SDKs" />
  <img src="https://img.shields.io/badge/IDE-VS%20Code%20%2B%20JetBrains-purple.svg" alt="IDE" />
</p>

---

## Why HEXVault?

Most AI coding tools forget everything between sessions.  
Most PR reviewers have **zero knowledge** of your past decisions, bug fixes, or architecture choices.

**HEXVault fixes both.**

| Capability | What you get |
|------------|----------------|
| **Project Memory Vault** | Decisions, bug fixes, architecture notes, patterns & security rules — SQLite (TTL, importance, auto-tags, links) |
| **Hybrid Search** | Keyword + semantic ranking over embeddings |
| **RAG Chat** | Grounded answers with citations (`/v1/chat`, CLI, dashboard, IDE) |
| **Smart PR Reviewer** | Context-aware reviews + optional LLM · GitHub Action |
| **Multi-model LLMs** | OpenAI · Anthropic · Grok · Gemini · OpenRouter · Groq · Mistral · DeepSeek · Azure · Ollama · LM Studio |
| **Knowledge Graph** | Interactive graph (zoom / pan / search) |
| **Webhooks & Notify** | HMAC-signed webhooks · Slack / Discord / Teams / Notion / Jira / Linear |
| **Team sync** | Export/import vault bundles · multi-repo linking |
| **Dashboards** | Next.js (light/dark, ⌘K) |
| **SDKs** | TypeScript · Go · Python |
| **IDE plugins** | **VS Code** (React webview + TanStack Query) · **JetBrains** |

**No API key required** — AI features have rule-based fallbacks. Add keys when you want LLM power (`hexvault providers`).

---

## Quick Start

```bash
npm install          # Node ≥ 18

npx hexvault init
npx hexvault add "We use SQLite and never hardcode secrets" --type decision --tags security
npx hexvault search "auth"
npx hexvault ask "Which database did we choose?"

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
| Memory engine v3 (importance, TTL, categories, links, embeddings) | ✅ |
| Hybrid search · RAG chat · PR reviewer · GitHub Action | ✅ |
| Multi-provider LLMs + rule fallbacks | ✅ |
| REST API + GraphQL · sync export/import · multi-repo | ✅ |
| Next.js dashboard · knowledge graph · CLI + TUI | ✅ |
| Webhooks (HMAC) · notify channels | ✅ |
| SDKs — TypeScript, Python, Go | ✅ |
| **VS Code extension** — sidebar WebviewView, React 18, TanStack Query cache | ✅ |
| **JetBrains plugin** — tool window, search / add selection / ask | ✅ |
| Docker · CI (lint / typecheck / tests) | ✅ |

---

## IDE Extensions

### VS Code (`packages/vscode-extension`)

| Feature | Detail |
|---------|--------|
| Sidebar panel | Activity bar **HEXVault** (WebviewView) |
| UI | **React 18** + esbuild bundle |
| Caching | **TanStack Query** (search 60s · health 30s staleTime) |
| Commands | Search · Add selection · Ask · Health |
| Settings | `hexvault.baseUrl` · `hexvault.token` |

```bash
cd packages/vscode-extension
npm install && npm run build
# F5 → Extension Development Host  (API must be running)
```

### JetBrains (`packages/jetbrains-plugin`)

```bash
cd packages/jetbrains-plugin
./gradlew buildPlugin && ./gradlew runIde
```

---

## API surface (highlights)

| Method | Path |
|--------|------|
| GET/POST | `/v1/memories` |
| GET | `/v1/search?q=` |
| POST | `/v1/chat` · `/v1/review` |
| GET | `/v1/graph` · `/v1/analyze` · `/v1/stats` |
| GET/POST | `/v1/sync/export` · `/v1/sync/import` |
| POST | `/graphql` |
| GET | `/health` |

Full reference: [docs/api/REST.md](docs/api/REST.md)

---

## SDKs

```ts
import { HexVaultClient } from "@hexvault/sdk";
const c = new HexVaultClient({ baseUrl: "http://127.0.0.1:3850" });
await c.search("sqlite");
```

Python: `packages/sdk-python` · Go: `packages/sdk-go`

---

## Quality & audit

| Doc | Link |
|-----|------|
| World-class audit | [docs/AUDIT_WORLDCLASS.md](docs/AUDIT_WORLDCLASS.md) |
| Quality scores (honest) | [docs/QUALITY_REPORT.md](docs/QUALITY_REPORT.md) |
| Architecture diagrams | [docs/architecture/diagrams.md](docs/architecture/diagrams.md) |
| Code of Conduct | [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |

---

## Docs

| Guide | Path |
|-------|------|
| Setup | [docs/guides/SETUP.md](docs/guides/SETUP.md) |
| Architecture | [docs/architecture/overview.md](docs/architecture/overview.md) |
| REST + GraphQL | [docs/api/REST.md](docs/api/REST.md) |
| Environment | [docs/guides/ENVIRONMENT.md](docs/guides/ENVIRONMENT.md) |
| 14-phase status | [docs/PHASES.md](docs/PHASES.md) |
| VS Code | [packages/vscode-extension/README.md](packages/vscode-extension/README.md) |
| JetBrains | [packages/jetbrains-plugin/README.md](packages/jetbrains-plugin/README.md) |

---

## Configuration

`.hexvault.yml` via `hexvault init`. Env: [docs/guides/ENVIRONMENT.md](docs/guides/ENVIRONMENT.md)  
Production tip: set **`HEXVAULT_API_TOKEN`** when the API is reachable beyond localhost.

---

## Architecture

```
src/core · src/api · src/cli · src/action · src/providers
apps/web                    # Next.js dashboard (canonical UI)
packages/sdk{,-python,-go}
packages/vscode-extension   # React + TanStack Query
packages/jetbrains-plugin
```

Diagrams: [docs/architecture/diagrams.md](docs/architecture/diagrams.md)

---

## Development

```bash
npm run lint && npm run format:check
npx tsc --noEmit && npm test && npm run build
```

CI: `.github/workflows/ci.yml`

---

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) · [SECURITY.md](SECURITY.md)

## License

MIT © [sawon2026](https://github.com/sawon2026)

---

<p align="center">
  <img src="assets/hexvault-logo.svg" width="64" height="64" alt="HEXVault logo" />
  <br/>
  <sub><b>HEXVault</b> — Because your project deserves a memory, and every PR deserves context.</sub>
</p>
