// Shared contract every PM-tool adapter (jira.ts, asana.ts, trello.ts,
// slack.ts) implements. `secret` is whatever credential the provider needs
// (Jira: API token; Asana: PAT; Trello: "key:token" combined; Slack: bot
// token) and `config` is the non-secret routing info (project key, board id,
// channel id, etc). Both come from the Integration table — see
// src/lib/db/store.ts upsertIntegration/getIntegration.
//
// Security note (flagging, not silently fixing — same posture as the RLS
// advisory elsewhere in this app): `secret` is stored in the Integration
// table's accessTokenEnc column as PLAIN TEXT in this build, despite the
// column name. Real encryption-at-rest (e.g. via a KMS-backed envelope key)
// is a follow-up; anyone with DB access — and per the RLS advisory, that
// currently includes anyone with the anon key — can read these tokens today.

export interface TicketPayload {
  title: string;
  description: string;
}

export interface ExternalTicket {
  externalId: string;
  externalUrl: string;
  externalStatus?: string;
}

export interface ExternalTicketSummary {
  id: string;
  title: string;
  status: string;
  url: string;
}

export interface IntegrationAdapter {
  createTicket(config: Record<string, string>, secret: string, payload: TicketPayload): Promise<ExternalTicket>;
  listTickets(config: Record<string, string>, secret: string): Promise<ExternalTicketSummary[]>;
}

// Renders the rich Ticket fields (why scenario, feature description, test
// cases, acceptance criteria, telemetry, success metric) into one formatted
// description body, since none of Jira/Asana/Trello have native fields for
// these — this is the single place that formatting logic lives, so every
// adapter's createTicket gets the same body shape.
export function formatTicketDescription(fields: {
  description?: string | null;
  whyScenario?: string | null;
  featureDescription?: string | null;
  testCases?: string | null;
  acceptanceCriteria?: string | null;
  telemetry?: string | null;
  successMetric?: string | null;
}): string {
  const section = (label: string, value?: string | null) => (value?.trim() ? `${label}\n${value.trim()}\n\n` : "");
  return (
    section("Description:", fields.description) +
    section("Why (scenario):", fields.whyScenario) +
    section("Feature description:", fields.featureDescription) +
    section("Test cases:", fields.testCases) +
    section("Acceptance criteria:", fields.acceptanceCriteria) +
    section("Telemetry:", fields.telemetry) +
    section("Success metric:", fields.successMetric)
  ).trim();
}
