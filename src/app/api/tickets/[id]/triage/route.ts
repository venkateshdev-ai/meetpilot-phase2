import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, triageTicket, listMembershipsByRole } from "@/lib/db/store";
import { can, Role } from "@/lib/rbac";
import { SLA_HOURS, REQUEST_TYPE_LABELS } from "@/lib/revops";

// Triage a request: set type, priority, owning system, and assignee, and let
// the SLA clock be (re)derived from the agreed priority.
//
// Restricted to Admin/Global Admin: an SLA is a commitment the org makes to a
// stakeholder, so a read-only Reviewer must not be able to set or move one.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const roleByUser = await listMembershipsByRole();
  const role = roleByUser[me.id] as Role | undefined;
  if (!role || !can(role, "request:triage")) {
    return NextResponse.json(
      { error: "Only an Admin or Global Admin can triage requests and set SLAs." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  // Validate against the policy module so an unknown priority can never create
  // a request with an SLA the app has no rule for.
  if (body.priority && !(body.priority in SLA_HOURS)) {
    return NextResponse.json({ error: `Unknown priority "${body.priority}"` }, { status: 422 });
  }
  if (body.requestType && !(body.requestType in REQUEST_TYPE_LABELS)) {
    return NextResponse.json({ error: `Unknown request type "${body.requestType}"` }, { status: 422 });
  }

  try {
    const ticket = await triageTicket(
      params.id,
      {
        requestType: body.requestType,
        priority: body.priority,
        systemId: body.systemId,
        assigneeId: body.assigneeId,
        status: body.status,
        acceptanceCriteria: body.acceptanceCriteria,
      },
      me.id
    );
    return NextResponse.json(ticket);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 500 });
  }
}
