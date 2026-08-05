# Migrating to HEXVault v3.0.0

v3.0.0 is a fully backward-compatible upgrade. Databases created by v1/v2 are
upgraded **in place** by `MemoryStore.migrateV1()` — no export/import needed.

## Step 1 — Upgrade the package

```bash
npm install hexvault@latest
```

If you install from source:

```bash
git pull
npm install        # better-sqlite3 is optional — node:sqlite is primary
```

## Step 2 — Verify schema migration

Run the CLI once — the store migrates automatically:

```bash
hexvault stats
```

Check the log line `[memory-store] Schema ready (v2)` (or a migration notice).
Health endpoint is a good post-upgrade check:

```bash
hexvault health
```

## Step 3 — What changed

### New memory fields (auto-migrated)

| Field | v2 behavior | v3 behavior |
|-------|-------------|-------------|
| `importance` | computed at add | **persisted** per entry (0..1), used in ranking & health |
| `ttl_expires` | default-TTL only | **per-memory TTL**, `setTtl`, auto-purge |
| `category` | — | optional grouping, surfaced in analytics/health |
| `embedding` | — | persisted vectors (local hash / OpenAI / Ollama) for semantic search |
| `links` | — | memory ↔ repo/issue/PR/commit/conversation links |

### New types

`conversation` memory type — created automatically by chat/`recordConversation`.

### Behavior changes

- `rule-based` LLM output is now always labeled `source: "rules"` and is
  never reported as an LLM reply. Check `res.source` before trusting content
  in scripts.
- Webhook endpoint defaults changed: an endpoint with no event filter now
  receives **all** event types (previously a fixed subset). Use
  `?events=a,b` to restrict.
- Config files are validated with Zod — invalid `.hexvault.yml` fails fast
  with a clear `CONFIG_INVALID` error instead of silent defaults.

## Step 4 — Config migration (optional)

Your existing `.hexvault.yml` keeps working. New optional sections
(`llm.priority`, `notifications.channels`, `webhooks`, `multiRepo`) can be
added — run `hexvault init` in a scratch dir to see the full default file,
then copy the sections you want.

## Step 5 — Rollback

Databases are backward-compatible in the read direction (v2 reads ignore new
columns). If you must downgrade, back up first:

```bash
hexvault sync-export -o backup.json
```

## Node version note

- Node ≥ 22.5: primary path (built-in `node:sqlite`) — no native build.
- Node 18–22.4: `better-sqlite3` fallback — requires a working build toolchain
  or prebuilt binaries for your platform.
