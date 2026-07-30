import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, createTicket, listTicketsForOrg } from "@/lib/db/store";
import { SLA_HOURS, REQUEST_TYPE_LABELS, SOURCE_LABELS } from "@/lib/revops";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const tickets = await listTicketsForOrg();
  return NextResponse.json(tickets);
}

// Creates a MeetPilot-side Ticket row. This is the source of truth for the
// rich fields (why scenario, feature description, test cases, acceptance
// criteria, telemetry, success metric) — pushing it to Jira/Asana/Trello
// (POST /api/tickets/[id]/push) is a separate, optional step.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  // These three now drive the SLA clock and queue position, so they are
  // validated against the policy module rather than spread through from the
  // request body — an unknown priority would otherwise create a request with
  // a deadline the app has no rule for.
  if (body.priority && !(body.priority in SLA_HOURS)) {
    return NextResponse.json({ error: `Unknown priority "${body.priority}"` }, { status: 422 });
  }
  if (body.requestType && !(body.requestType in REQUEST_TYPE_LABELS)) {
    return NextResponse.json({ error: `Unknown request type "${body.requestType}"` }, { status: 422 });
  }
  if (body.source && !(body.source in SOURCE_LABELS)) {
    return NextResponse.json({ error: `Unknown source "${body.source}"` }, { status: 422 });
  }

  const ticket = await createTicket({ ...body, createdById: me.id });
  return NextResponse.json(ticket, { status: 201 });
}
