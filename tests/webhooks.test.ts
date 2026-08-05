import { describe, it, expect } from "vitest";
import { createHmac, timingSafeEqual } from "crypto";
import http from "node:http";
import {
  endpointsFromEnv,
  deliverWebhooks,
} from "../src/core/webhooks/emitter.js";

describe("webhook emitter", () => {
  it("endpointsFromEnv parses URL list with wildcard events by default", () => {
    process.env.HEXVAULT_WEBHOOK_URLS = "http://a.test/hook,http://b.test/hook";
    delete process.env.HEXVAULT_WEBHOOK_EVENTS;
    delete process.env.HEXVAULT_WEBHOOK_SECRET;
    const eps = endpointsFromEnv();
    expect(eps.length).toBe(2);
    expect(eps[0].url).toBe("http://a.test/hook");
    expect(eps[0].events.length).toBe(0); // wildcard — all events
    expect(eps[0].secret).toBeUndefined();
    process.env.HEXVAULT_WEBHOOK_URLS = "";
  });

  it("honors global EVENTS/SECRET envs", () => {
    process.env.HEXVAULT_WEBHOOK_URLS = "http://a.test/hook";
    process.env.HEXVAULT_WEBHOOK_EVENTS = "memory.added,review.completed";
    process.env.HEXVAULT_WEBHOOK_SECRET = "global-secret";
    const eps = endpointsFromEnv();
    expect(eps[0].events).toEqual(["memory.added", "review.completed"]);
    expect(eps[0].secret).toBe("global-secret");
    process.env.HEXVAULT_WEBHOOK_URLS = "";
    delete process.env.HEXVAULT_WEBHOOK_EVENTS;
    delete process.env.HEXVAULT_WEBHOOK_SECRET;
  });

  it("parses per-endpoint events and secret from URL query params", () => {
    process.env.HEXVAULT_WEBHOOK_URLS =
      "http://a.test/hook?events=memory.added&secret=s3cret";
    const eps = endpointsFromEnv();
    expect(eps[0].url).toBe("http://a.test/hook"); // query stripped
    expect(eps[0].events).toEqual(["memory.added"]);
    expect(eps[0].secret).toBe("s3cret");
    process.env.HEXVAULT_WEBHOOK_URLS = "";
  });

  it("delivers with HMAC signature when secret configured", async () => {
    const received: { body: unknown; sig?: string } = {};
    const server = BunOrNodeServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(Buffer.from(c));
      received.body = JSON.parse(Buffer.concat(chunks).toString());
      received.sig = req.headers["x-hexvault-signature"] as string;
      res.writeHead(200);
      res.end("ok");
    });

    const port = await server.listen();
    const url = `http://127.0.0.1:${port}/hook`;
    const event = {
      type: "memory.added" as const,
      payload: { id: "m1" },
      timestamp: new Date().toISOString(),
    };
    const out = await deliverWebhooks(event, [
      { url, events: [], secret: "test-secret" },
    ]);

    expect(out.length).toBe(1);
    expect(out[0].ok).toBe(true);
    expect(received.body).toEqual(event);
    const sig = received.sig ?? "";
    const expected = createHmac("sha256", "test-secret")
      .update(JSON.stringify(event))
      .digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    expect(a.length === b.length && timingSafeEqual(a, b)).toBe(true);
    await server.close();
  });

  it("filters endpoints by event subscription", async () => {
    const event = {
      type: "memory.added" as const,
      payload: { id: "m1" },
      timestamp: new Date().toISOString(),
    };
    const out = await deliverWebhooks(event, [
      { url: "http://127.0.0.1:1/x", events: ["sync.imported"] },
    ]);
    expect(out.length).toBe(0);
  });
});

// Minimal HTTP server for delivery tests.
function BunOrNodeServer(
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => Promise<void>,
) {
  const server = http.createServer((req, res) => {
    handler(req, res).catch(() => {
      res.writeHead(500);
      res.end();
    });
  });
  return {
    async listen(): Promise<number> {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const addr = server.address();
      return typeof addr === "object" && addr ? addr.port : 0;
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
