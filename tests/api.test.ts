import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { createApiServer } from "../src/api/server.js";

describe("REST API", () => {
  let dir: string;
  let api: ReturnType<typeof createApiServer>;
  let base: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hexvault-api-"));
    fs.mkdirSync(path.join(dir, ".hexvault"), { recursive: true });
    // minimal config so loadConfig works
    fs.writeFileSync(
      path.join(dir, ".hexvault.yml"),
      `memory:\n  path: .hexvault/memory.db\n  vector: true\n`,
    );
    process.chdir(dir);
    api = createApiServer({ port: 0, host: "127.0.0.1", cwd: dir });
    // bind random port
    await new Promise<void>((resolve) => {
      api.server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = api.server.address();
    const port = typeof addr === "object" && addr ? addr.port : 3850;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => api.server.close(() => resolve()));
    api.engine.close();
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("GET /health", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("POST /v1/memories and search", async () => {
    const create = await fetch(`${base}/v1/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "API test memory",
        content: "JWT auth required",
        type: "security",
        tags: ["auth"],
      }),
    });
    expect(create.status).toBe(201);

    const search = await fetch(`${base}/v1/search?q=jwt`);
    expect(search.status).toBe(200);
    const data = (await search.json()) as { count: number };
    expect(data.count).toBeGreaterThanOrEqual(1);
  });
});
