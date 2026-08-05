# HEXVault REST API (v3.0.0)

Zero-dependency HTTP API over the Memory Engine. The same surface is exposed
as GraphQL at `/graphql` and `/v1/graphql`.

## Start

```bash
npm run api
# → http://127.0.0.1:3850
```

| Variable | Default | Description |
|----------|---------|-------------|
| `HEXVAULT_API_PORT` | `3850` | Port |
| `HEXVAULT_API_HOST` | `127.0.0.1` | Bind address (use `0.0.0.0` for containers) |
| `HEXVAULT_API_TOKEN` | _(empty)_ | If set, require `Authorization: Bearer <token>` |
| `HEXVAULT_DATA_DIR` | `cwd` | Working directory containing `.hexvault.yml` / `.hexvault/` |

Errors use a stable shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "...", "details": {} } }
```

All responses are JSON. Body size is capped at 2 MiB.

## Health & introspection

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness: `{ ok, version, uptimeSec, node, providers, webhooks }` |
| GET | `/v1/health` | Alias of `/health` |
| GET | `/v1/health/memory` | Memory health report (stale/expired/orphaned, importance) |
| GET | `/v1/stats` | Memory counts by type, tags, expired |
| GET | `/v1/analytics` | Timeline, tag cloud, top recent, 30-day growth |
| GET | `/v1/timeline?limit=200` | Memories grouped per day with type breakdown |
| GET | `/v1/tags?limit=100` | Tag frequency |
| GET | `/v1/graph?limit=60&w=900&h=560` | Knowledge graph (nodes/edges/stats) |

## Memories

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/memories?limit=50&type=note` | List memories (optional type filter) |
| POST | `/v1/memories` | Create memory |
| GET | `/v1/memories/:id` | Get one memory |
| PATCH | `/v1/memories/:id` | Update title/content/type/tags/importance/ttl |
| DELETE | `/v1/memories/:id` | Delete memory |

Create body:

```json
{
  "title": "Use SQLite",
  "content": "Local-first storage decision",
  "type": "decision",
  "tags": ["db"],
  "category": "storage",
  "importance": 0.9,
  "ttlDays": 90,
  "autoTag": true,
  "links": [{ "kind": "repository", "id": "hexvault", "label": "hexvault" }]
}
```

`type` ∈ `note | decision | bugfix | architecture | security | pattern | api | refactor | conversation`.
`importance` ∈ `0..1` (defaults by type). `ttlDays` schedules automatic expiry.

## Search & intelligence

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/search?q=auth&limit=10` | Hybrid keyword + semantic search |
| GET | `/v1/multi-repo/search?q=x&repos=a,b` | Search across linked repositories |
| POST | `/v1/analyze` | Heuristic scan for complexity hotspots / dead code |
| POST | `/v1/review` | Rule-based + AI PR review |
| POST | `/v1/chat` | RAG chat over memories |
| POST | `/v1/commit-message` | Suggest a commit message |
| POST | `/v1/release-notes` | Generate release notes |
| POST | `/v1/changelog` | Generate changelog |
| POST | `/v1/explain` | Explain a code snippet |
| POST | `/v1/deps` | Dependency report |
| POST | `/v1/webhook/test` | Fire a test webhook |

### Chat

```json
{ "question": "What database did we choose?", "conversationId": "opt-here" }
```

Returns `{ answer, sources: [{ id, title, relevance }], conversationId }`.
Pass `conversationId` back to continue a threaded conversation — each turn is
recorded as a `conversation` memory linked to the thread.

## Sync

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/sync/export?limit=500` | Export vault as a sync bundle |
| POST | `/v1/sync/import` | Import/merge a bundle `{ bundle }` |

## Webhooks

On `memory.added`, `memory.updated`, `memory.deleted`, `review.completed`,
`sync.imported`, `sync.exported` the API fans out to configured endpoints.
Payloads are signed with `X-Hexvault-Signature: HMAC-SHA256(secret, body)`
when a secret is configured.

| Variable | Description |
|----------|-------------|
| `HEXVAULT_WEBHOOK_URLS` | Comma-separated URLs, e.g. `https://h.example/hook?events=memory.added&secret=s3cret` |
| `HEXVAULT_WEBHOOK_EVENTS` | Global event filter (default: all) |
| `HEXVAULT_WEBHOOK_SECRET` | Global signing secret |

Per-URL `?events=` and `?secret=` query params override the globals.

## Notifications

`src/core/notifications/notify.ts` renders messages for Slack, Discord,
Teams, Notion, Jira, and Linear; delivery is wired via webhooks
(see `HEXVAULT_WEBHOOK_URLS` above).

## GraphQL

Same capabilities via `POST /graphql` / `POST /v1/graphql` — schema in
`src/api/graphql.ts`. Queries: `health, memories, search, stats, timeline,
tags, memoryHealth`. Mutations: `addMemory, updateMemory, deleteMemory, chat`.
