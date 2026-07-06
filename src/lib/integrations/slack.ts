// Slack isn't a ticket tracker, so it doesn't implement the same
// create-a-ticket semantics as Jira/Asana/Trello — "pushing" a ticket to
// Slack posts a formatted notification message to a channel instead.
// config: { channelId }. secret: Bot token (create an app at
// api.slack.com/apps, add chat:write scope, install to workspace, invite the
// bot to the target channel).
import type { IntegrationAdapter, ExternalTicket, ExternalTicketSummary, TicketPayload } from "./types";

export const slackAdapter: IntegrationAdapter = {
  async createTicket(config, secret, payload: TicketPayload): Promise<ExternalTicket> {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: config.channelId,
        text: `*${payload.title}*\n${payload.description}`,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Slack: ${data.error ?? "unknown error"}`);
    }
    return {
      externalId: data.ts,
      externalUrl: `slack://channel?team=${data.channel}&message=${data.ts}`,
      externalStatus: "Posted",
    };
  },

  // No concept of "tickets" to list back from Slack.
  async listTickets(): Promise<ExternalTicketSummary[]> {
    return [];
  },
};
