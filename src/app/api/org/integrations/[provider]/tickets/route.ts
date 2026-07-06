import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrgIntegration } from "@/lib/db/store";
import { getAdapter } from "@/lib/integrations";

// Live read-through to whatever tool is connected — "list all tickets I
// already have in Jira/Asana/Trello", not MeetPilot's own Ticket table.
// Real network call every time (no caching yet) since ticket status changes
// externally and we want that reflected without a webhook/poller.
export async function GET(_req: Request, { params }: { params: { provider: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const provider = params.provider.toUpperCase();
  const integration = await getOrgIntegration(provider);
  if (!integration || !integration.accessTokenEnc) {
    return NextResponse.json({ error: `${provider} isn't connected` }, { status: 404 });
  }

  try {
    const adapter = getAdapter(provider);
    const tickets = await adapter.listTickets(integration.config ?? {}, integration.accessTokenEnc);
    return NextResponse.json(tickets);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
