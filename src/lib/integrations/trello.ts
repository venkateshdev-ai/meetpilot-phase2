// Trello REST API. config: { boardId, listId }. secret: "key:token" combined
// (get an API key at trello.com/app-key, then generate a token from the
// "Token" link on that same page — Trello doesn't do bearer/basic auth, both
// go as query params on every call).
import type { IntegrationAdapter, ExternalTicket, ExternalTicketSummary, TicketPayload } from "./types";

const BASE = "https://api.trello.com/1";

function parseSecret(secret: string) {
  const [key, token] = secret.split(":");
  return { key, token };
}

export const trelloAdapter: IntegrationAdapter = {
  async createTicket(config, secret, payload: TicketPayload): Promise<ExternalTicket> {
    const { key, token } = parseSecret(secret);
    const params = new URLSearchParams({
      idList: config.listId,
      name: payload.title,
      desc: payload.description,
      key,
      token,
    });
    const res = await fetch(`${BASE}/cards?${params.toString()}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Trello ${res.status}: ${body}`);
    }
    const data = await res.json();
    return {
      externalId: data.id,
      externalUrl: data.shortUrl ?? data.url,
      externalStatus: "Open",
    };
  },

  async listTickets(config, secret): Promise<ExternalTicketSummary[]> {
    const { key, token } = parseSecret(secret);
    const params = new URLSearchParams({ key, token });
    const res = await fetch(`${BASE}/boards/${config.boardId}/cards?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Trello ${res.status}: ${body}`);
    }
    const data = await res.json();
    return (data ?? []).map((c: any) => ({
      id: c.id,
      title: c.name,
      status: c.closed ? "Archived" : "Open",
      url: c.shortUrl ?? c.url,
    }));
  },
};
