# HEXVault Deep Repository Audit (v2.0)

**Date:** 2026-08-05
**Scope:** Full repository — every file reviewed (approx. 120 tracked paths)

---

## 1. Architecture Review

| Area | Status | Notes |
|------|--------|-------|
| Layering | Good | `src/core/**` cleanly separated from `cli`, `api`, `action`, `dashboard`, `providers`, `config` |
| Memory stack | Solid | `MemoryStore` (SQLite) → `MemoryEngine` (ranking/dedup/hybrid) layering is correct |
| Review pipeline | Solid | `ReviewEngine` (rule) + `AIReviewEngine` (LLM merge) + `types.ts` contract |
| LLM abstraction | Partial | `LLMProvider` interface exists; Anthropic is faked via OpenAI-compatible proxy; no streaming |
| Vector layer | Partial | `EmbeddingProvider` interface + `InMemoryVectorIndex`; vectors not persisted |
| DI / interfaces | Weak | Concrete classes instantiated directly in CLI/API/TUI (`new MemoryStore(...)` everywhere) |
| Config | Weak | YAML merge-by-hand, no validation, no env validation; `HexVaultConfig` not Zod-validated |
| Error handling | Partial | `AppError` exists but is not used consistently (raw `throw new Error` in many places) |
| Logging | Good | Structured `Logger` with child scopes + JSON mode |
| Graph | Good | `buildKnowledgeGraph` + `layoutGraph` (force-directed, zero deps) |
| Web app | Good | Next.js 14 + Tailwind + `lib/api.ts` client; server components for SSR pages |
| Dashboard (legacy) | Obsolete | `src/dashboard/server.ts` plain-HTTP dashboard duplicates Next.js app — **superseded** |

**Verdict:** The existing architecture is sound. Preserve it. Fill gaps: persistence of vectors, provider registry expansion, DI container for the API, validation, consistent errors.

---

## 2. Security Review

| Finding | Severity | Status / Action |
|---------|----------|-----------------|
| Secrets only via env | OK | `HEXVAULT_API_KEY`, `XAI_API_KEY`, etc. |
| Hardcoded secrets in code | Medium | `LLMRegistry` fallback path uses `apiKey || ""`; `Azure` endpoint read from env — verify `.gitignore` covers `.env*` (present) |
| `better-sqlite3` native module | Medium | Requires Visual Studio toolchain to build from source; breaks installs on machines without it (see Performance) |
| API auth | OK | Optional bearer token via `HEXVAULT_API_TOKEN`; CORS `*` on API — tighten with config |
| Dashboard / API bind address | OK | Defaults to `127.0.0.1`; document `0.0.0.0` risk |
| Webhook URLs | OK | Env-only |
| SQL injection | OK | All queries parameterized |
| XSS in legacy dashboard | Fixed path | Legacy `escapeHtml` present; superseded by Next.js app |
| Supply chain | Medium | No lockfile committed at root (`package-lock.json` absent from listing); add `npm ci` reliability |

---

## 3. Performance Review

| Area | Finding |
|------|---------|
| SQLite | Indexed on `type` + `created_at`; full-table scan for `LIKE` search — acceptable at local scale, FTS5 is the upgrade path |
| Embeddings | Hash-based 64-dim — O(n) scan per query in `MemoryEngine.hybridSearch` (`list(200)` + cosine for all). Fine ≤ thousands of memories; real embeddings + SQLite FTS5 recommended beyond that |
| Dedup | `findDuplicate` re-embeds all candidates per add — O(n) embeddings per write; cache embeddings per memory (persist vector) |
| API server | Single connection, no request body limit — add size cap for `readBody` |
| Dashboard server | Opens a new DB connection per request (legacy only) |
| Next.js | Static pages (no dashboard) are `force-dynamic` — fine; consider `unstable_noStore` patterns |
| LLM calls | Retry with exponential-ish backoff (linear ×attempt) — add jitter |

---

## 4. Scalability Review

- Local-first single-process model is correct for the product (memory = project-scoped SQLite).
- Multi-repo linker already cross-db; needs `repo` field on memories for unified analytics — **add workspace/repo linking to entries**.
- API is stateless per request; can scale horizontally behind a load balancer (SQLite WAL supports single-writer; document multi-instance caveat).
- No queue — acceptable; document "large ingest" guidance.
- Web app fetches server-side → can scale independently.

---

## 5. Maintainability Review

| Gap | Severity |
|-----|----------|
| `better-sqlite3` native build breaks `npm install` on machines without VS Build Tools (verified on this machine) | **Critical** |
| No lockfile → non-reproducible installs | High |
| `engines.node >= 18` but code uses `structuredClone` (Node ≥17) — fine, but `node:sqlite` would need ≥22.5 | High |
| `src/dashboard/` legacy HTTP dashboard duplicates Next.js app | Medium (keep as fallback, document) |
| Extension is a scaffold without `extension.js` | Medium |
| Tests: 14 files but no coverage of CLI/API error paths, sync round-trips, registry fallback | Medium |
| No lint config file (`eslint src` script has no `.eslintrc`/`eslint.config.*`) — `npm run lint` is broken | **Critical** |
| No formatting tool (prettier) | Low |
| `hexvault-review.yml` calls `npx tsx` at runtime — slow, no Docker | Medium |

---

## 6. Missing Features Report

### Core engine
- [ ] Per-entry TTL expiration (only global default)
- [ ] Memory importance scoring persisted + explainability
- [ ] Automatic tagging (keyword → tag suggestion)
- [ ] Memory categories
- [ ] Conversation linking (chat sessions → memories)
- [ ] Repository / workspace linking on entries
- [ ] Cross-repository semantic search (multi-repo uses keyword `search` only)
- [ ] Memory timeline API + UI
- [ ] Memory health dashboard data (stale, orphaned, dup clusters)
- [ ] Memory analytics (growth over time, tag clouds)
- [ ] Citation support (retrieval provenance in chat)
- [ ] Summarization of long memories / chat history
- [ ] Memory update (`PATCH`), full `DELETE` endpoint (CLI only has delete in store)

### AI
- [ ] Changelog generator
- [ ] Documentation generator
- [ ] Architecture explanation
- [ ] Dependency analyzer (package.json → summary)
- [ ] Code smell detection (exists partial: heuristics)
- [ ] Dead code detection (exists: heuristics)
- [ ] Complexity analysis (exists)
- [ ] Explain code / Explain architecture commands
- [ ] Generate tests / examples
- [ ] Issue analysis
- [ ] PR review enhancement (inline comments with path/line)

### Multi-model
- [ ] Streaming support (`stream: true`)
- [ ] Azure OpenAI correct base URL construction (currently `/chat/completions` appended to bare endpoint)
- [ ] Embedding provider registry (only local + openai)
- [ ] Model override via config for each provider
- [ ] Provider status endpoint (`/v1/providers/status`)

### DX / API
- [ ] Webhook system (outbound event delivery: review complete, memory added)
- [ ] `DELETE /v1/memories/:id`, `PATCH /v1/memories/:id`
- [ ] `GET /v1/timeline`, `GET /v1/tags`, `GET /v1/health` detail
- [ ] GraphQL: only 6 operations — add `timeline`, `tags`, `deleteMemory`
- [ ] SDK: delete/update/timeline methods
- [ ] CLI: `delete`, `update`, `tag`, `timeline`, `docs`, `explain`, `changelog`, `deps`, `webhook` commands
- [ ] TUI: memory detail view, tag browsing

### DevOps
- [ ] Dockerfile + docker-compose (API + web)
- [ ] Lint pipeline (no lint config exists)
- [ ] Coverage upload (Codecov)
- [ ] Lockfile
- [ ] Prettier + husky/lint-staged

---

## 7. Technical Debt Report

1. **Critical — build blocker:** `better-sqlite3@^11.7.0` requires node-gyp + Visual Studio; `npm install` fails on this machine (verified). → Migrate to `node:sqlite` (Node ≥22.5, zero native deps) with `better-sqlite3` optional fallback.
2. `eslint src --ext .ts` references a config that doesn't exist → `npm run lint` always fails.
3. No `package-lock.json` → CI `npm ci || npm install` silently degrades.
4. `src/dashboard/server.ts` legacy duplicate → mark deprecated, keep for zero-dep environments.
5. `createLLMProvider("anthropic")` uses OpenAI wire format — wrong for real Anthropic API; registry keeps it as OpenAI-compatible (documented).
6. `Azure` provider: endpoint without path → broken without `api-version` handling.
7. `MemoryStore.search` is `LIKE %q%` with no ranking; `score: 1` for all keyword hits.
8. `AIReviewEngine.safeParse` regex `\{[\s\S]*\}` can over-match JSON with braces in content.
9. `readBody` has no size cap → DoS vector on localhost API.
10. `FeedbackStore` schema lacks memory-content snapshot (needs JOIN to understand downvotes).
11. Docs scattered; `docs/AUDIT_v1.md` superseded.
12. Extension scaffold lacks implementation (`extension.js` referenced but missing).

---

## 8. UX Review

| Aspect | Verdict |
|--------|---------|
| CLI output | Clean, colored, informative. Missing `--json` flag for scripting |
| TUI | Good zero-dep design; no keyboard shortcuts beyond numbers, no detail view |
| Dashboard | Dark premium look (glassmorphism, gradients); **light mode missing**; no command palette; no keyboard shortcuts; no timeline/analytics/settings pages |
| Graph | Interactive select + filter; no zoom/pan/search |
| Empty states | Present (API offline banner, "no memories" states) — good |
| Onboarding | Good: guides + video + GIFs |
| Accessibility | Dark-only, some `<button>` without aria-labels in graph; no focus-visible styling |

---

## 9. API Review

| Endpoint | Verdict |
|----------|---------|
| `GET /health`, `/v1/health` | OK, add version + providers + uptime |
| `GET/POST /v1/memories` | Missing `PATCH`/`DELETE` |
| `GET /v1/search` | OK (hybrid) |
| `GET /v1/stats`, `/v1/analytics` | OK |
| `GET /v1/graph` | OK, no filter/kind params |
| `POST /graphql` | Working subset; add ops |
| `GET /v1/multi-repo/search` | Keyword only → add `hybrid` mode |
| `GET /v1/sync/export` `POST /v1/sync/import` | OK |
| `GET /v1/analyze` | OK |
| `POST /v1/review` | Returns only related memories — not a real review; document or implement full review |
| `POST /v1/chat` | OK + `context` |
| `POST /v1/commit-message`, `/v1/release-notes` | OK |
| Error format | Inconsistent (mixed plain `{error}` and `AppError.toJSON()`) — unify via error handler |
| Request size limit | Missing |

---

## 10. Documentation Review

| Doc | Verdict |
|-----|---------|
| README.md | Professional; version badge outdated (0.4.0 vs 2.3.0); mentions `npm run dashboard` for legacy; needs updated architecture + badges |
| docs/architecture/overview.md | Thin; needs upgrade + diagram |
| docs/api/REST.md | Sparse; needs full endpoint reference |
| docs/guides/SETUP.md | Good |
| docs/PHASES.md | Status table out of date |
| SECURITY.md / CONTRIBUTING.md / CHANGELOG.md / ROADMAP.md | Present, can be enriched |
| Missing | FAQ, Troubleshooting, Migration guide, CLI reference doc, SDK docs (only README stubs), API error codes |

---

## Decision

**Do not rewrite.** Execute the 14-phase upgrade on the existing architecture, in dependency order:

1. Fix the install/build blocker (`node:sqlite`) — everything else depends on a working build.
2. Validation + errors + logging.
3. Memory engine intelligence.
4. AI feature expansion.
5. Multi-model + streaming.
6. DX/API/SDK surface.
7. Dashboard + graph UI.
8. DevOps + tests + docs + GitHub excellence.
