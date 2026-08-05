<p align="center">
  <img src="assets/hexvault-banner.svg" alt="HEXVault" width="100%" />
</p>

<p align="center">
  <img src="assets/hexvault-feature-strip.svg" alt="HEXVault features" width="100%" />
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
| **Project Memory Vault** | Decisions, bug fixes, architecture notes — SQLite + vectors |
| **Hybrid Search** | Keyword + semantic ranking |
| **RAG Chat** | Grounded answers with citations |
| **Smart PR Reviewer** | Context-aware reviews · GitHub Action |
| **Multi-model LLMs** | OpenAI · Anthropic · Grok · Gemini · Ollama · more |
| **Knowledge Graph** | Interactive graph |
| **Webhooks & Notify** | HMAC webhooks · Slack / Discord / Teams / … |
| **Team sync** | Export/import · multi-repo |
| **Dashboards** | Next.js light/dark |
| **SDKs** | TypeScript · Go · Python |
| **IDE plugins** | VS Code (React + TanStack Query) · JetBrains |

**No API key required** for rule-based mode. Add keys when you want LLM power.

---

## Quick Start

```bash
npm install
npx hexvault init
npx hexvault add "We use SQLite" --type decision --tags db
npx hexvault search "auth"
npx hexvault ask "Which database?"
npm run api    # http://127.0.0.1:3850
npm run web    # http://localhost:3000
```

```bash
docker compose up --build
```

---

## IDE Extensions

**VS Code** — `packages/vscode-extension` (React webview + TanStack Query)  
**JetBrains** — `packages/jetbrains-plugin`

---

## Quality & docs

- [Audit](docs/AUDIT_WORLDCLASS.md) · [Quality scores](docs/QUALITY_REPORT.md) · [Diagrams](docs/architecture/diagrams.md)
- [Setup](docs/guides/SETUP.md) · [API](docs/api/REST.md) · [Code of Conduct](CODE_OF_CONDUCT.md)
- Brand assets: [assets/README.md](assets/README.md)

Production tip: set **`HEXVAULT_API_TOKEN`** if the API is not localhost-only.

---

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · MIT © [sawon2026](https://github.com/sawon2026)

---

<p align="center">
  <img src="assets/hexvault-logo.svg" width="72" height="72" alt="HEXVault logo" />
  <br/>
  <sub><b>HEXVault</b> — Because your project deserves a memory, and every PR deserves context.</sub>
</p>
