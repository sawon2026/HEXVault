/**
 * Example: use @hexvault/sdk against a local API
 * Run: npx tsx examples/sdk-usage.ts  (with `npm run api` in another terminal)
 */
import { HexVaultClient } from "../packages/sdk/src/index.js";

async function main() {
  const client = new HexVaultClient({ baseUrl: "http://127.0.0.1:3850" });
  const health = await client.health();
  console.log("health", health);

  await client.addMemory({
    content: "SDK example memory — SQLite is our local store",
    type: "decision",
    tags: ["sdk", "db"],
  });

  const search = await client.search("SQLite");
  console.log("search hits", search.count);

  const chat = await client.chat("What storage do we use?");
  console.log("chat:", chat.answer.slice(0, 200));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
