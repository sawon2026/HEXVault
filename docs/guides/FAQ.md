# HEXVault FAQ

## What is HEXVault?

A local-first AI memory platform for software projects: it stores decisions,
patterns, bugs, and API notes; finds them with hybrid search; chats about them
(RAG); reviews PRs; generates release notes/changelogs/docs; and links
knowledge across repositories — all with zero-dependency rule fallbacks when
no LLM key is configured.

## Do I need an API key?

No. The core engine is fully functional without keys. AI features use
deterministic rule fallbacks (labeled `source: "rules"`) until you set a
provider key. See `docs/guides/ENVIRONMENT.md`.

## Where is data stored?

A single SQLite database per project at `.hexvault/memory.db` (configurable
via `memory.path` in `.hexvault.yml`). No cloud, no telemetry.

## Which LLMs are supported?

OpenAI, Anthropic, Grok, Gemini, OpenRouter, Groq, Mistral, DeepSeek,
Azure OpenAI, Ollama, and LM Studio — tried in configurable priority order
with retries and a final rule-based fallback.

## How does chat work?

`POST /v1/chat` (or `hexvault ask`, or the dashboard) retrieves relevant
memories (hybrid search), grounds the answer in them, and returns citations
(`sources`). Passing `conversationId` continues a thread; each turn is stored
as a `conversation` memory linked to that thread.

## How is the knowledge graph built?

`GET /v1/graph` derives nodes (memories, types, tags) and edges from the
store — no external graph database. The dashboard renders it with zoom/pan,
search, and filtering.

## Can multiple instances sync?

Yes — `hexvault sync-export` / `POST /v1/sync/import` exchange
`hexvault-sync-v1` bundles; imports merge (dedup by content hash).

## Is there a GitHub Action?

Yes — `.github/workflows/hexvault-review.yml` runs PR reviews, and
`src/action/` is the Action entrypoint. GitLab/Bitbucket provider modules
ship in `src/providers/`.

## Can I use it with VS Code / Cursor?

The `src/extension/` scaffold targets VS Code/Cursor; the CLI and REST API
are usable from any editor.

## How is memory importance decided?

By type (decision 0.9, security 0.8, bugfix 0.75, architecture 0.7,
pattern 0.65, api 0.6, refactor 0.55, note 0.5, conversation 0.35) with a
recency boost for recent entries; you can override with `--importance` /
`importance` on any add.

## How do I remove stale knowledge?

Set `ttlDays` on add (or `--ttl-days`) — entries expire and purge
automatically. Health warnings identify stale (> 180d) and orphaned memories.
