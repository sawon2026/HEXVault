---
name: hexvault-ship
description: Ship HEXVault features end-to-end — implement core/API/CLI/SDK/dashboard changes, update changelog and roadmap, then push to sawon2026/HEXVault on GitHub. Use when the user asks to continue HEXVault, next step, phase complete, push to GitHub, or world-class upgrade work.
---

# HEXVault ship workflow

## Repo

- GitHub `sawon2026/HEXVault`
- Local sandbox often under `/home/workdir/artifacts/HEXVault`
- Preserve architecture; do not rewrite from scratch

## Before coding

1. Read `ROADMAP.md` and `docs/PHASES.md`
2. Prefer extending existing modules under `src/core/`, `src/api/`, `src/cli/`, `packages/`
3. Keep the project buildable

## Implement

- Core logic in `src/core/<domain>/`
- Wire CLI in `src/cli/index.ts` when user-facing
- Wire REST in `src/api/server.ts`; GraphQL in `src/api/graphql.ts`
- TS SDK `packages/sdk`, Python SDK `packages/sdk-python`
- Dashboard `apps/web`
- Tests under `tests/`

## Ship checklist

1. Bump version in root `package.json` when releasing
2. Update `CHANGELOG.md` and `ROADMAP.md`
3. Add/adjust tests for new behavior
4. Push via GitHub tools (`create_or_update_file` / `push_files`) to branch `main`
5. Summarize for the user in their language when they write in Bangla

## Do not

- Remove existing features unless obsolete
- Commit secrets or API keys
- Promise infinite autonomous loops without delivering discrete shipped increments

## Phase priority order

When user says continue automatically, ship the highest unfinished item from ROADMAP Next, then push.
