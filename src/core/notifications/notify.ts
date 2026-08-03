/**
 * Slack / Discord / Webhook notifications
 */

export type NotifyChannel = "slack" | "discord" | "webhook";

export interface NotifyPayload {
  title: string;
  body: string;
  score?: number;
  prUrl?: string;
  level?: "info" | "warning" | "error" | "success";
}

export async function sendNotification(
  channel: NotifyChannel,
  webhookUrl: string,
  payload: NotifyPayload
): Promise<boolean> {
  if (!webhookUrl) return false;

  try {
    if (channel === "slack") {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `*${payload.title}*\n${payload.body}${payload.prUrl ? `\n${payload.prUrl}` : ""}`,
        }),
      });
      return true;
    }

    if (channel === "discord") {
      const color =
        payload.level === "error"
          ? 0xef4444
          : payload.level === "warning"
            ? 0xf59e0b
            : payload.level === "success"
              ? 0x22c55e
              : 0x3b82f6;

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: payload.title,
              description: payload.body,
              color,
              url: payload.prUrl,
              fields: payload.score !== undefined
                ? [{ name: "Score", value: `${payload.score}/100`, inline: true }]
                : [],
            },
          ],
        }),
      });
      return true;
    }

    // generic webhook
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch {
    return false;
  }
}
