# HEXVault Environment Variables

All optional unless noted. No API keys are required for the core memory
engine — AI features degrade to rule-based fallbacks when no provider is set.

## Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `HEXVAULT_DATA_DIR` | process cwd | Directory holding `.hexvault.yml` and `.hexvault/` |
| `HEXVAULT_LOG_JSON` | unset | `1` to emit JSON log lines |
| `HEXVAULT_LLM_PRIORITY` | `rule-based` | Comma-separated provider order (overrides config) |
| `HEXVAULT_API_PORT` | `3850` | REST API port |
| `HEXVAULT_API_HOST` | `127.0.0.1` | REST API bind address |
| `HEXVAULT_API_TOKEN` | unset | If set, API requires `Authorization: Bearer <token>` |
| `HEXVAULT_API_KEY` | unset | Fallback key shared by keyed providers |
| `HEXVAULT_WEBHOOK_URLS` | unset | Comma-separated webhook endpoints (supports per-URL `?events=` & `?secret=`) |
| `HEXVAULT_WEBHOOK_EVENTS` | unset | Global webhook event filter |
| `HEXVAULT_WEBHOOK_SECRET` | unset | Global HMAC-SHA256 signing secret |

## LLM providers

| Provider | Env var | Notes |
|----------|---------|-------|
| OpenAI | `OPENAI_API_KEY` | `OPENAI_BASE_URL`, `OPENAI_MODEL` override |
| Anthropic | `ANTHROPIC_API_KEY` | Native messages API, streaming |
| Grok | `XAI_API_KEY` | `XAI_BASE_URL`, `XAI_MODEL` |
| Gemini | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | OpenAI-compatible endpoint |
| OpenRouter | `OPENROUTER_API_KEY` | |
| Groq | `GROQ_API_KEY` | |
| Mistral | `MISTRAL_API_KEY` | |
| DeepSeek | `DEEPSEEK_API_KEY` | |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | Plus `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` |
| Ollama | `OLLAMA_HOST` (default `http://localhost:11434/v1`) | Local; no key needed |
| LM Studio | `LMSTUDIO_HOST` (default `http://localhost:1234/v1`) | Local; no key needed |

## Vector embeddings

| Variable | Default | Description |
|----------|---------|-------------|
| `HEXVAULT_EMBEDDINGS` | `local` | `local` (hash-based, zero-dep) or `openai` / `ollama` |
| `OPENAI_API_KEY` | unset | Required when embeddings = `openai` |
| `OLLAMA_HOST` | `http://localhost:11434/v1` | Required when embeddings = `ollama` |

## Dashboard (apps/web)

| Variable | Default | Description |
|----------|---------|-------------|
| `HEXVAULT_API_URL` | `http://127.0.0.1:3850` | Server-side API base (SSR) |
| `PORT` / `HOSTNAME` | `3000` / `0.0.0.0` | Next.js bind (containers) |

Client-side requests go through the Next rewrite `/api/hex/*` → `HEXVAULT_API_URL`.

## Validation

Run `hexvault providers` (CLI) or `GET /health` to see which providers are
configured on this machine. Missing keys never crash the engine — features
fall back to deterministic rule-based output labeled `source: "rules"`.
