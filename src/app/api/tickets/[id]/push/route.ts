import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTicketById, getOrgIntegration, updateTicket } from "@/lib/db/store";
import { getAdapter, formatTicketDescription } from "@/lib/integrations";

// Pushes a MeetPilot Ticket to whichever connected tool the caller chooses.
// All the rich fields (why scenario, feature description, test cases,
// acceptance criteria, telemetry, success metric) get folded into the target
// tool's description field via formatTicketDescription — see the comment on
// that function for why (none of these tools have native custom fields for
// this without extra per-tool setup).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const provider = body?.provider?.toUpperCase();
  if (!provider) return NextResponse.json({ error: "provider is required" }, { status: 400 });

  const ticket = await getTicketById(params.id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const integration = await getOrgIntegration(provider);
  if (!integration || !integration.accessTokenEnc) {
    return NextResponse.json({ error: `${provider} isn't connected — add credentials in Admin > Integrations first` }, { status: 409 });
  }

  try {
    const adapter = getAdapter(provider);
    const description = formatTicketDescription(ticket);
    const result = await adapter.createTicket(integration.config ?? {}, integration.accessTokenEnc, {
      title: ticket.title,
      description,
    });

    const updated = await updateTicket(ticket.id, {
      provider,
      externalId: result.externalId,
      externalUrl: result.externalUrl,
      externalStatus: result.externalStatus ?? null,
      lastSyncedAt: new Date().toISOString(),
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
