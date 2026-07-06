// Asana REST API. config: { projectGid }. secret: Personal Access Token
// (generate at app.asana.com -> My Settings -> Apps -> Manage Developer Apps).
import type { IntegrationAdapter, ExternalTicket, ExternalTicketSummary, TicketPayload } from "./types";

const BASE = "https://app.asana.com/api/1.0";

export const asanaAdapter: IntegrationAdapter = {
  async createTicket(config, secret, payload: TicketPayload): Promise<ExternalTicket> {
    const res = await fetch(`${BASE}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          name: payload.title,
          notes: payload.description,
          projects: [config.projectGid],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Asana ${res.status}: ${body}`);
    }
    const { data } = await res.json();
    return {
      externalId: data.gid,
      externalUrl: data.permalink_url ?? `https://app.asana.com/0/${config.projectGid}/${data.gid}`,
      externalStatus: data.completed ? "Done" : "Open",
    };
  },

  async listTickets(config, secret): Promise<ExternalTicketSummary[]> {
    const res = await fetch(
      `${BASE}/projects/${config.projectGid}/tasks?opt_fields=name,completed,permalink_url`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Asana ${res.status}: ${body}`);
    }
    const { data } = await res.json();
    return (data ?? []).map((t: any) => ({
      id: t.gid,
      title: t.name,
      status: t.completed ? "Done" : "Open",
      url: t.permalink_url,
    }));
  },
};
