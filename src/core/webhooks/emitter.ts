/**
 * Outbound webhook delivery — fires events (memory.added, review.completed,
 * sync.imported, memory.deleted) to configured HTTP endpoints.
 *
 * Design:
 *  - In-process emitter (EventEmitter) for in-process subscribers.
 *  - `deliverWebhooks` fans out to external endpoints with timeout + retry.
 *  - Events are fire-and-forget by default; `await` when ordering matters.
 */
import { EventEmitter } from "events";
import { createHmac } from "crypto";
import { log } from "../logging/logger.js";

const logger = log.child("webhooks");

export type WebhookEventType =
  | "memory.added"
  | "memory.updated"
  | "memory.deleted"
  | "review.completed"
  | "sync.imported"
  | "sync.exported";

export interface WebhookEvent {
  type: WebhookEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookEndpoint {
  url: string;
  events: WebhookEventType[];
  secret?: string;
  headers?: Record<string, string>;
}

/** In-process emitter — modules subscribe for side effects. */
export const webhookBus = new EventEmitter();
webhookBus.setMaxListeners(50);

/** Publish an event to in-process subscribers AND external endpoints. */
export async function publishWebhook(
  type: WebhookEventType,
  payload: Record<string, unknown>,
  endpoints: WebhookEndpoint[] = [],
): Promise<void> {
  const event: WebhookEvent = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
  webhookBus.emit(type, event);
  if (endpoints.length) {
    await deliverWebhooks(event, endpoints);
  }
}

/** Fan out an event to external webhook endpoints (with retries). */
export async function deliverWebhooks(
  event: WebhookEvent,
  endpoints: WebhookEndpoint[],
): Promise<{ url: string; ok: boolean; status?: number }[]> {
  const results: { url: string; ok: boolean; status?: number }[] = [];
  for (const endpoint of endpoints) {
    const wants =
      endpoint.events.length === 0 ||
      endpoint.events.includes(event.type as never) ||
      endpoint.events.includes("*" as never);
    if (!wants) continue;
    const ok = await deliverOne(endpoint, event);
    results.push({ url: endpoint.url, ok, status: ok ? 200 : undefined });
  }
  return results;
}

async function deliverOne(
  endpoint: WebhookEndpoint,
  event: WebhookEvent,
): Promise<boolean> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "hexvault-webhook/3",
          "X-Hexvault-Event": event.type,
          "X-Hexvault-Timestamp": event.timestamp,
          ...(endpoint.secret
            ? { "X-Hexvault-Signature": signPayload(event, endpoint.secret) }
            : {}),
          ...(endpoint.headers || {}),
        },
        body: JSON.stringify(event),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const ok = res.ok;
      logger.debug("Webhook delivered", {
        url: endpoint.url,
        event: event.type,
        status: res.status,
        attempt,
      });
      return ok;
    } catch (err) {
      logger.warn("Webhook delivery failed", {
        url: endpoint.url,
        event: event.type,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)));
      }
    }
  }
  return false;
}

/** HMAC-SHA256 signature over JSON payload for receiver verification. */
function signPayload(event: WebhookEvent, secret: string): string {
  const body = JSON.stringify(event);
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Build endpoints from env: comma-separated URLs (global EVENTS/SECRET) with
 *  optional per-URL overrides via query params: ?events=a,b&secret=s. */
export function endpointsFromEnv(): WebhookEndpoint[] {
  const raw = (
    process.env.HEXVAULT_WEBHOOK_URLS ||
    process.env.HEXVAULT_WEBHOOK_URL ||
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const globalEvents = (process.env.HEXVAULT_WEBHOOK_EVENTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as WebhookEventType[];
  const globalSecret = process.env.HEXVAULT_WEBHOOK_SECRET;

  return raw.map((entry) => {
    let url = entry;
    let events = globalEvents;
    let secret = globalSecret;
    const qIndex = url.indexOf("?");
    if (qIndex !== -1) {
      const query = new URLSearchParams(url.slice(qIndex + 1));
      url = url.slice(0, qIndex);
      const ev = query.get("events");
      if (ev) {
        events = ev
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean) as WebhookEventType[];
      }
      const sec = query.get("secret");
      if (sec) secret = sec;
    }
    return { url, events, secret };
  });
}
