# HEXVault Architecture Overview

## Core Modules

```
src/
├── core/
│   ├── memory/          # SQLite memory store
│   ├── review/          # Rule-based + AI reviewer
│   ├── llm/             # Unified LLM providers (OpenAI, Grok, Anthropic, Ollama)
│   ├── vector/          # Lightweight embeddings + semantic search
│   ├── ingest/          # Auto-ingest from PRs & commits
│   ├── feedback/        # Thumbs up/down learning
│   ├── notifications/   # Slack / Discord / Webhook
│   └── multi-repo/      # Cross-repo memory linking
├── providers/           # GitHub (via Action), GitLab, Bitbucket
├── cli/                 # hexvault CLI
├── action/              # GitHub Action entrypoint
├── dashboard/           # Self-hosted web UI
└── extension/           # VS Code / Cursor extension scaffold
```

## Data Flow

1. **Ingest** → Manual CLI / Auto from merged PR / Commit message
2. **Store** → SQLite (+ optional vector index)
3. **Retrieve** → Keyword + Semantic + File-based hybrid search
4. **Review** → Rule heuristics + LLM (when configured)
5. **Feedback** → Votes stored → used to rank/penalize memories
6. **Notify** → Optional Slack/Discord on review complete

## Extensibility

- Swap LLM via `llm.provider` in `.hexvault.yml`
- Add custom review rules in config
- Link multiple repos via `multi-repo.json`
- Extend providers for other Git hosts
