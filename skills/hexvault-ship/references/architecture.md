# HEXVault architecture quick ref

- `src/core/memory` — SQLite store + MemoryEngine (hybrid search, ranking)
- `src/core/llm` — multi-provider registry
- `src/core/review` — PR review heuristics
- `src/core/analysis` — complexity / dead-code
- `src/core/graph` — knowledge graph builder
- `src/core/multi-repo` — cross-repo search
- `src/api/server.ts` — REST (+ GraphQL mount)
- `src/cli` — commander CLI + `tui`
- `apps/web` — Next.js dashboard
- `packages/sdk` — TypeScript client
- `packages/sdk-python` — Python client
