import { jiraAdapter } from "./jira";
import { asanaAdapter } from "./asana";
import { trelloAdapter } from "./trello";
import { slackAdapter } from "./slack";
import type { IntegrationAdapter } from "./types";

export const ADAPTERS: Record<string, IntegrationAdapter> = {
  JIRA: jiraAdapter,
  ASANA: asanaAdapter,
  TRELLO: trelloAdapter,
  SLACK: slackAdapter,
};

export function getAdapter(provider: string): IntegrationAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`No integration adapter for provider "${provider}"`);
  return adapter;
}

export { formatTicketDescription } from "./types";
export type { TicketPayload, ExternalTicket, ExternalTicketSummary } from "./types";
