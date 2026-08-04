# @hexvault/sdk

Official TypeScript client for [HEXVault](https://github.com/sawon2026/HEXVault).

```ts
import { HexVaultClient } from "@hexvault/sdk";

const client = new HexVaultClient({ baseUrl: "http://127.0.0.1:3850" });
await client.addMemory({ content: "Use SQLite", type: "decision" });
const { results } = await client.search("database");
const { answer } = await client.chat("What DB do we use?");
```

See full method table in this README on GitHub. Requires `npm run api`.
