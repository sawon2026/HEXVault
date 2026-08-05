import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { MemoryEngine } from "../src/core/memory/engine.js";
import { executeGraphql } from "../src/api/graphql.js";

describe("GraphQL gateway", () => {
  let dir: string;
  let engine: MemoryEngine;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hex-gql-"));
    engine = new MemoryEngine({ dbPath: path.join(dir, "t.db") });
  });

  afterEach(() => {
    engine.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns health", async () => {
    const res = await executeGraphql(engine, { query: "{ health { ok version } }" });
    expect(res.errors).toBeUndefined();
    expect((res.data as any).health.ok).toBe(true);
  });

  it("addMemory mutation", async () => {
    const res = await executeGraphql(engine, {
      query: "mutation { addMemory { id title } }",
      variables: { content: "From GraphQL", type: "note" },
    });
    expect((res.data as any).addMemory.id).toBeTruthy();
  });
});
