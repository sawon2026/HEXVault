# @hexvault/sdk

Official TypeScript client for the [HEXVault](https://github.com/sawon2026/HEXVault) REST API.

## Install

```bash
# from monorepo
npm install ./packages/sdk

# or after publish
npm install @hexvault/sdk
```

## Quick start

```ts
import { HexVaultClient } from "@hexvault/sdk";

const client = new HexVaultClient({
  baseUrl: "http://127.0.0.1:3850",
  // token: process.env.HEXVAULT_API_TOKEN,
});

await client.health();
await client.addMemory({
  title: "DB choice",
  content: "We use SQLite locally",
  type: "decision",
  tags: ["db"],
});

const { results } = await client.search("sqlite");
const { answer } = await client.chat("What database do we use?");
const graph = await client.graph({ limit: 40 });
```

## API surface

| Method | Endpoint |
|--------|----------|
| `health()` | `GET /health` |
| `listMemories()` | `GET /v1/memories` |
| `getMemory(id)` | `GET /v1/memories/:id` |
| `addMemory(...)` | `POST /v1/memories` |
| `search(q)` | `GET /v1/search` |
| `stats()` / `analytics()` | stats endpoints |
| `chat(q)` | `POST /v1/chat` |
| `commitMessage(input)` | `POST /v1/commit-message` |
| `releaseNotes(...)` | `POST /v1/release-notes` |
| `review(...)` | `POST /v1/review` |
| `analyze()` | `GET /v1/analyze` |
| `graph()` | `GET /v1/graph` |

Requires HEXVault API running (`npm run api` from repo root).

## License

MIT
