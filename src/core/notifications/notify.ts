/**
 * Notifications — Slack / Discord / Microsoft Teams / Notion / Jira / Linear / generic webhook.
 * All channels render a structured payload into their native message format.
 */
import { AppError } from "../errors/app-error.js";
import { log } from "../logging/logger.js";

const logger = log.child("notify");

export type NotifyChannel =
  "slack" | "discord" | "webhook" | "teams" | "notion" | "jira" | "linear";

export interface NotifyPayload {
  title: string;
  body: string;
  score?: number;
  prUrl?: string;
  level?: "info" | "warning" | "error" | "success";
  metadata?: Record<string, unknown>;
}

export interface NotifyOptions {
  timeoutMs?: number;
}

export async function sendNotification(
  channel: NotifyChannel,
  webhookUrl: string,
  payload: NotifyPayload,
  opts: NotifyOptions = {},
): Promise<boolean> {
  if (!webhookUrl) return false;

  try {
    const body = render(channel, payload);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10_000);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logger.warn("Notification rejected", {
        channel,
        status: res.status,
        body: (await res.text()).slice(0, 200),
      });
      return false;
    }
    return true;
  } catch (err) {
    logger.warn("Notification failed", {
      channel,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Render a payload into the channel's native message shape. */
export function render(
  channel: NotifyChannel,
  payload: NotifyPayload,
): unknown {
  switch (channel) {
    case "slack":
      return {
        text: `*${payload.title}*\n${payload.body}${payload.prUrl ? `\n${payload.prUrl}` : ""}`,
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*${payload.title}*` },
          },
          { type: "section", text: { type: "mrkdwn", text: payload.body } },
          ...(payload.prUrl
            ? [
                {
                  type: "section",
                  text: { type: "mrkdwn", text: payload.prUrl },
                },
              ]
            : []),
        ],
      };

    case "discord":
      return {
        embeds: [
          {
            title: payload.title,
            description: payload.body,
            color: colorFor(payload.level),
            url: payload.prUrl,
            fields:
              payload.score !== undefined
                ? [
                    {
                      name: "Score",
                      value: `${payload.score}/100`,
                      inline: true,
                    },
                  ]
                : [],
          },
        ],
      };

    case "teams":
      return {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              type: "AdaptiveCard",
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              version: "1.4",
              body: [
                {
                  type: "TextBlock",
                  text: payload.title,
                  weight: "Bolder",
                  size: "Medium",
                },
                { type: "TextBlock", text: payload.body, wrap: true },
                ...(payload.score !== undefined
                  ? [{ type: "TextBlock", text: `Score: ${payload.score}/100` }]
                  : []),
                ...(payload.prUrl
                  ? [{ type: "TextBlock", text: payload.prUrl }]
                  : []),
              ],
            },
          },
        ],
      };

    case "notion":
      return {
        object: "page",
        properties: {
          title: {
            title: [{ text: { content: payload.title.slice(0, 200) } }],
          },
          description: {
            rich_text: [{ text: { content: payload.body.slice(0, 2000) } }],
          },
        },
        metadata: payload.metadata || {},
      };

    case "jira":
      return {
        summary: payload.title.slice(0, 255),
        description: `${payload.body}\n\nScore: ${payload.score ?? "n/a"}${payload.prUrl ? `\n${payload.prUrl}` : ""}`,
        issuetype: { name: "Task" },
      };

    case "linear":
      return {
        title: payload.title.slice(0, 255),
        description: `${payload.body}${payload.prUrl ? `\n\n${payload.prUrl}` : ""}`,
      };

    case "webhook":
    default:
      return payload;
  }
}

function colorFor(level?: NotifyPayload["level"]): number {
  switch (level) {
    case "error":
      return 0xef4444;
    case "warning":
      return 0xf59e0b;
    case "success":
      return 0x22c55e;
    default:
      return 0x3b82f6;
  }
}

/** Resolve a configured channel + env var into a notification send. */
export async function notifyFromConfig(
  channel: NotifyChannel,
  webhookUrlEnv: string,
  payload: NotifyPayload,
): Promise<boolean> {
  const url =
    process.env[webhookUrlEnv] || process.env.HEXVAULT_WEBHOOK_URL || "";
  if (!url) {
    throw new AppError(
      "CONFIG_INVALID",
      `Webhook URL not configured (env ${webhookUrlEnv})`,
    );
  }
  return sendNotification(channel, url, payload);
}
