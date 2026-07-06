import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, createTicket, listTicketsForOrg } from "@/lib/db/store";

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

  const ticket = await createTicket({ ...body, createdById: me.id });
  return NextResponse.json(ticket, { status: 201 });
}
