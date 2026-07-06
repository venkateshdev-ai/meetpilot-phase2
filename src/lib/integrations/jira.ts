// Jira Cloud REST API v2 (v2 accepts a plain-string description; v3 requires
// Atlassian Document Format, which is unnecessary complexity for this use
// case). config: { siteUrl, userEmail, projectKey }. secret: API token
// (generate at id.atlassian.com/manage-profile/security/api-tokens).
import type { IntegrationAdapter, ExternalTicket, ExternalTicketSummary, TicketPayload } from "./types";

function authHeader(userEmail: string, apiToken: string) {
  return `Basic ${Buffer.from(`${userEmail}:${apiToken}`).toString("base64")}`;
}

export const jiraAdapter: IntegrationAdapter = {
  async createTicket(config, secret, payload: TicketPayload): Promise<ExternalTicket> {
    const { siteUrl, userEmail, projectKey } = config;
    const res = await fetch(`https://${siteUrl}/rest/api/2/issue`, {
      method: "POST",
      headers: {
        Authorization: authHeader(userEmail, secret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: payload.title,
          description: payload.description,
          issuetype: { name: "Task" },
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Jira ${res.status}: ${body}`);
    }
    const data = await res.json();
    return {
      externalId: data.key,
      externalUrl: `https://${siteUrl}/browse/${data.key}`,
      externalStatus: "To Do",
    };
  },

  async listTickets(config, secret): Promise<ExternalTicketSummary[]> {
    const { siteUrl, userEmail, projectKey } = config;
    const jql = encodeURIComponent(`project=${projectKey} ORDER BY created DESC`);
    const res = await fetch(`https://${siteUrl}/rest/api/2/search?jql=${jql}&maxResults=50`, {
      headers: { Authorization: authHeader(userEmail, secret) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Jira ${res.status}: ${body}`);
    }
    const data = await res.json();
    return (data.issues ?? []).map((issue: any) => ({
      id: issue.key,
      title: issue.fields?.summary ?? "(no title)",
      status: issue.fields?.status?.name ?? "Unknown",
      url: `https://${siteUrl}/browse/${issue.key}`,
    }));
  },
};
