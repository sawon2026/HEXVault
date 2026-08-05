# HEXVault Architecture Overview (v3.0.0)

## Core Modules

```
src/
├── core/
│   ├── db/sqlite.ts         # SQLite adapter: node:sqlite (Node ≥22.5) with
│   │                        #   better-sqlite3 optional fallback — zero native builds
│   ├── memory/              # MemoryStore (schema v2) + MemoryEngine
│   ├── llm/                 # Multi-provider LLM layer (11 providers, streaming, retries)
│   ├── vector/              # Embeddings: local hash / OpenAI / Ollama
│   ├── ai/                  # Features (changelog, docs, explain, tests, deps, issue)
│   │                        #   + repo-chat (RAG) + summarize — every feature has a
│   │                        #   deterministic rule-based fallback
│   ├── review/              # Rule heuristics + AI reviewer
│   ├── ingest/              # Auto-ingest from PRs & commits
│   ├── feedback/            # Thumbs up/down learning
│   ├── notifications/       # Slack / Discord / Teams / Notion / Jira / Linear
│   ├── webhooks/            # Event bus + signed (HMAC) webhook delivery with retries
│   ├── env/                 # Env validation + provider status
│   ├── sync/                # Export/import bundles (team sync)
│   ├── multi-repo/          # Cross-repo memory linking
│   ├── errors/              # Typed AppError
│   └── logging/             # Structured logging (JSON optional)
├── api/                     # REST + GraphQL server (zero-dependency, :3850)
├── cli/                     # hexvault CLI (full surface) + TUI
├── action/                  # GitHub Action entrypoint
├── dashboard/               # Legacy self-hosted UI (:3847)
├── providers/               # GitHub (Action), GitLab, Bitbucket
└── extension/               # VS Code / Cursor extension scaffold
apps/
├── web/                     # Next.js dashboard (dark + light theme, ⌘K palette,
│                            #   hybrid search, chat, timeline, knowledge graph
│                            #   with zoom/pan, settings) — standalone build
packages/
├── sdk/                     # TypeScript SDK
├── sdk-go/                  # Go SDK
└── sdk-python/              # Python SDK
```

## Storage

- SQLite via `src/core/db/sqlite.ts` — uses the **built-in `node:sqlite`
  (Node ≥ 22.5)** so there is no native compilation step; on older Node it
  falls back to `better-sqlite3` (optional dependency).
- Schema v2 columns: `category`, `importance`, `ttl_expires`, `embedding`,
  `links` (JSON). `MemoryStore.migrateV1()` upgrades v1 databases in place.
- TTLs are per-memory; expired entries are purged automatically on engine
  operations (`purgeExpired`).

## Data Flow

1. **Ingest** → CLI `add` / API `POST /v1/memories` / auto-ingest from merged PR
2. **Store** → SQLite, importance scored by type (decision 0.9, security 0.8,
   bugfix 0.75, …), auto-tagging via stopword-free keyword extraction, optional
   embedding persistence
3. **Retrieve** → hybrid search: keyword (LIKE) + semantic re-rank
   (`cosineSimilarity` over persisted embeddings), dedup on near-identical content
4. **AI** → provider priority chain (config `llm.priority` or
   `HEXVAULT_LLM_PRIORITY`) with jittered retries; `rule-based` is reserved as
   the absolute fallback and never masquerades as an LLM reply
5. **Review / Analyze** → rule heuristics first, LLM enrich when configured
6. **Sync** → export/import bundles for team sharing
7. **Notify** → webhook fan-out with HMAC signatures; per-channel formats for
   Slack/Discord/Teams/Notion/Jira/Linear

## Concurrency & Safety

- All reads/writes are synchronous SQLite transactions — no race conditions
  at the store layer; the API is single-process.
- Memory entries are immutable-ish: updates go through `store.update` with
  field-level patches.
- Webhook delivery retries 3× with exponential backoff and a 10s timeout.

## Extensibility

- **LLMs**: add a provider in `src/core/llm/provider.ts` (`LLMProviderName`
  union + `createLLMProvider` case); dashboard health picks it up
  automatically via `PROVIDER_ENV` in `src/core/env/validate.ts`.
- **Embeddings**: add to `src/core/vector/providers.ts`
  (`EmbeddingProviderName` + `createEmbeddingProvider`).
- **Webhooks**: extend `WebhookEventType` in `src/core/webhooks/emitter.ts`.
- **Notifications**: add a channel to `src/core/notifications/notify.ts`.
- **Rules**: every AI feature keeps a deterministic rule implementation —
  runnable with zero configuration.

## Key Properties

| Property | Guarantee |
|----------|-----------|
| Build | `npm run build` (tsc emit) + `npm run web:build` (Next standalone) |
| Verification | `npm run lint`, `npm run format:check`, `npx tsc --noEmit`, `npm test` |
| Runtime | Node ≥ 18 (node:sqlite path needs ≥ 22.5) |
| Deployment | Docker (API + web) or bare Node; data on a volume |

See `docs/AUDIT_v2.md` for the original audit, `docs/PHASES.md` for the
14-phase status, and `docs/api/REST.md` for the HTTP surface.
