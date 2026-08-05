import { describe, it, expect } from "vitest";
import {
  HexVaultClient,
  HexVaultApiError,
  createClient,
} from "../packages/sdk/src/index.js";

describe("@hexvault/sdk client", () => {
  it("constructs with defaults", () => {
    const c = createClient();
    expect(c.baseUrl).toBe("http://127.0.0.1:3850");
  });

  it("strips trailing slash", () => {
    const c = new HexVaultClient({ baseUrl: "http://localhost:3850/" });
    expect(c.baseUrl).toBe("http://localhost:3850");
  });

  it("throws HexVaultApiError on HTTP error", async () => {
    const c = new HexVaultClient({
      baseUrl: "http://127.0.0.1:9",
      timeoutMs: 500,
      fetch: async () =>
        new Response(JSON.stringify({ error: "nope" }), { status: 500 }),
    });
    await expect(c.health()).rejects.toBeInstanceOf(HexVaultApiError);
  });

  it("parses successful JSON", async () => {
    const c = new HexVaultClient({
      fetch: async () =>
        new Response(JSON.stringify({ ok: true, version: "2.0.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    const h = await c.health();
    expect(h.ok).toBe(true);
    expect(h.version).toBe("2.0.0");
  });

  it("sends Authorization when token set", async () => {
    let auth = "";
    const c = new HexVaultClient({
      token: "secret-token",
      fetch: async (_url, init) => {
        auth = (init?.headers as Record<string, string>)?.Authorization || "";
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
    await c.health();
    expect(auth).toBe("Bearer secret-token");
  });
});
