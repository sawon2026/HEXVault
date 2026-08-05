# HEXVault CLI (v3.0.0)

```bash
npm install -g hexvault   # or: npx hexvault
hexvault --help
```

Global flags: `--cwd <dir>` (override working directory), `--json`
(structured output where supported).

## Commands

### Core

| Command | Description |
|---------|-------------|
| `hexvault init` | Create `.hexvault.yml` + `.hexvault/memory.db` |
| `hexvault add <content>` | Add a memory (`--title`, `--tags a,b`, `--files f1,f2`, `--type`, `--category`, `--importance 0-1`, `--ttl-days N`, `--no-autotag`) |
| `hexvault list [--limit n]` | List memories |
| `hexvault update <id> [--title] [--content] [--type] [--tags] [--category] [--importance]` | Update fields via flags |
| `hexvault delete <id>` | Delete a memory |
| `hexvault link <id> --kind repo --target repo-1 [--label hexvault]` | Link memory to a repo/issue/PR/commit/conversation |

### Search

| Command | Description |
|---------|-------------|
| `hexvault search <query>` | Hybrid keyword + semantic search |
| `hexvault timeline` | Activity grouped by day |
| `hexvault tags` | Tag frequency |
| `hexvault stats` | Store statistics |

### AI (rule fallbacks when no LLM key configured)

| Command | Description |
|---------|-------------|
| `hexvault review` | Review the current PR (GitHub/GitLab/Bitbucket env) |
| `hexvault commit-msg <message>` | Suggest a commit message (`--file path` to read input) |
| `hexvault release-notes -v 3.1.0` | Generate release notes |
| `hexvault changelog -v 3.1.0` | Generate changelog |
| `hexvault docs <file>` | Generate docs for a source file |
| `hexvault explain <file>` | Explain a source file |
| `hexvault deps [--review]` | Dependency report over manifests |
| `hexvault issue --title X --body Y --labels a,b` | Analyze an issue |
| `hexvault ask <question>` | RAG chat over memories (`--conversation-id` for threads) |
| `hexvault analyze -n 50` | Heuristic code scan (complexity, dead code) |

### Operations

| Command | Description |
|---------|-------------|
| `hexvault health` | Engine + provider health report |
| `hexvault providers` | Which LLM providers are configured |
| `hexvault webhook-test [--message m]` | Fire a test webhook |
| `hexvault sync-export -o bundle.json` | Export vault bundle |
| `hexvault sync-import bundle.json` | Import/merge bundle |
| `hexvault tui` | Interactive terminal UI |

Exit codes: `0` success, `1` operational error, `2` usage error.
