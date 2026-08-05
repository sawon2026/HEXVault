# HEXVault Troubleshooting

## `npm install` fails building `better-sqlite3`

HEXVault uses the **built-in `node:sqlite`** on Node ≥ 22.5 — no native build
is needed. On older Node it falls back to `better-sqlite3` (optional
dependency); if your toolchain can't build it, either:

- upgrade to Node ≥ 22.5 (recommended), or
- install with `npm install --omit=optional`

The engine logs `node:sqlite unavailable — falling back to better-sqlite3`
if the fallback path is taken.

## API starts but dashboard shows "API offline"

- Confirm the API is running: `curl http://127.0.0.1:3850/health`
- The dashboard reads `HEXVAULT_API_URL` (server-side) and proxies
  `/api/hex/*` to it. In Docker, set `HEXVAULT_API_URL=http://api:3850`.
- If the API is bound to `127.0.0.1` only, containers can't reach it —
  set `HEXVAULT_API_HOST=0.0.0.0`.

## Search returns no results for a known term

The hybrid ranker combines keyword matches with a semantic score (default
threshold 0.08). Short, generic queries can fall below the threshold.
Retry with a more specific term (e.g. `jwt` instead of `authentication`) or
add memories with explicit tags.

## AI features return generic output

All AI features have deterministic rule fallbacks. Output labeled
`source: "rules"` means no LLM provider was configured. Check with
`hexvault providers` and set the matching key from
`docs/guides/ENVIRONMENT.md`.

## Webhooks not delivered

- Verify endpoints: `hexvault webhook-test`
- Events are filtered: either subscribe to all (no `?events=` param) or use
  the exact event name (`memory.added`, `review.completed`, …).
- Check `HEXVAULT_WEBHOOK_SECRET` — receivers must validate the
  `X-Hexvault-Signature` header (HMAC-SHA256 over the raw JSON body).

## "memory.db is locked" / SQLITE_BUSY

The engine is single-process. Don't open the same database from two API
instances — run one API (or one per data dir). Backups should use
`hexvault sync-export` rather than copying the live db.

## Node 18/20 users

The full platform targets Node ≥ 22.5 (node:sqlite, SSE, streaming). On
18/20 everything still works via the `better-sqlite3` fallback, but the
dashboard and Docker images assume modern Node.

## Health endpoint shows warnings

`/v1/health/memory` reports stale, expired, and orphaned memories with
actionable recommendations — these are advisory, not failures.
