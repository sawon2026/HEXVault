# HEXVault Web Dashboard (v1.3)

Next.js 14 App Router + Tailwind. Talks to the HEXVault REST API.

## Run

**Terminal 1 — API (repo root)**

```bash
npm run api
# http://127.0.0.1:3850
```

**Terminal 2 — Dashboard**

```bash
cd apps/web
npm install
npm run dev
# http://localhost:3000
```

Optional: `HEXVAULT_API_URL=http://127.0.0.1:3850`

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Overview + API status |
| `/memories` | List + add memories |
| `/search` | Hybrid search |
| `/chat` | RAG repo chat |
| `/analyze` | Complexity / dead-code |

Next rewrites `/api/hex/*` → API so the browser stays same-origin.
