import { HexVaultClient } from "../packages/sdk/src/index.js";

async function main() {
  const client = new HexVaultClient({ baseUrl: "http://127.0.0.1:3850" });
  console.log("health", await client.health());
  await client.addMemory({
    content: "SDK example — SQLite is our local store",
    type: "decision",
    tags: ["sdk", "db"],
  });
  console.log("search", (await client.search("SQLite")).count);
  console.log("chat", (await client.chat("What storage do we use?")).answer.slice(0, 200));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
