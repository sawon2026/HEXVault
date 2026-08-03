# HEXVault REST API (v1.1)

## Start

```bash
npm run api
# → http://127.0.0.1:3850
```

| Variable | Default | Description |
|----------|---------|-------------|
| `HEXVAULT_API_PORT` | `3850` | Port |
| `HEXVAULT_API_HOST` | `127.0.0.1` | Bind address |
| `HEXVAULT_API_TOKEN` | _(empty)_ | Optional Bearer token |

## Endpoints

- `GET /health`
- `GET /v1/memories?limit=&type=`
- `POST /v1/memories` — `{ title, content, type, tags, files }`
- `GET /v1/memories/:id`
- `GET /v1/search?q=&limit=`
- `POST /v1/review` — `{ title, body }`
- `GET /v1/stats`
- `GET /v1/analytics`

## curl examples

```bash
curl http://127.0.0.1:3850/health

curl -X POST http://127.0.0.1:3850/v1/memories \
  -H "Content-Type: application/json" \
  -d '{"title":"JWT only","content":"Auth uses short-lived JWT","type":"security"}'

curl "http://127.0.0.1:3850/v1/search?q=jwt"
```

## Embeddings

| Env | Values |
|-----|--------|
| `HEXVAULT_EMBED_PROVIDER` | `local` \| `openai` |
| `OPENAI_API_KEY` | For OpenAI embeddings |
| `HEXVAULT_EMBED_MODEL` | default `text-embedding-3-small` |
