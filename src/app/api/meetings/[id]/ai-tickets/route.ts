import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  findUserByEmail,
  createTicket,
  listTicketsForOrg,
  listUsers,
  listGtmSystems,
} from "@/lib/db/store";
import { suggestPriority, suggestRequestType, type RequestPriority } from "@/lib/revops";

// Materialises the tasks a human approved in the AI Review tab into real
// MeetPilot Ticket rows.
//
// Why this exists: the LangGraph orchestrator's execution node writes to the
// external CRM (Jira/HubSpot), but MeetPilot's own Ticket table is the source
// of truth for the rich spec fields and the in-app ticket list. Without this,
// approving in the HITL gate created tickets *outside* the product but left
// the Tickets page empty — the approval had no visible effect in the app.
//
// Idempotent: re-posting the same approved batch (e.g. a double-click, or a
// retry after a flaky response) will not duplicate tickets, because titles
// already present on this meeting are skipped.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const tasks = Array.isArray(body?.tasks) ? body.tasks : null;
  if (!tasks) return NextResponse.json({ error: "tasks[] is required" }, { status: 400 });

  const [existing, members, systems] = await Promise.all([
    listTicketsForOrg(),
    listUsers(),
    listGtmSystems(),
  ]);
  const alreadyOnThisMeeting = new Set(
    existing.filter((t) => t.meetingId === params.id).map((t) => t.title.trim().toLowerCase())
  );

  const created = [];
  for (const task of tasks) {
    const title = String(task?.summary ?? "").trim();
    if (!title || alreadyOnThisMeeting.has(title.toLowerCase())) continue;

    // The orchestrator returns an assignee *name* (that's what a transcript
    // gives you); map it back to a real user so the ticket has a live owner.
    const assigneeName = String(task?.assignee ?? "").trim();
    const match = assigneeName
      ? members.find((u) => u.name?.toLowerCase().includes(assigneeName.toLowerCase()))
      : undefined;

    const due = String(task?.due_date ?? "").trim();
    const priority = String(task?.priority ?? "").trim();
    const issueType = String(task?.issue_type ?? "").trim();

    // Classify the request from the language used in the meeting, and map it to
    // a registered system by name mention. Both are *suggestions* that land in
    // the queue flagged "Needs triage" — a human still owns the final call, so
    // an AI guess can never silently create an SLA commitment.
    const haystack = `${title} ${issueType}`.toLowerCase();
    const requestType = suggestRequestType(haystack);
    const matchedSystem = systems.find(
      (s) => haystack.includes(s.name.toLowerCase()) || title.toLowerCase().includes(s.name.toLowerCase())
    );
    // Honour an explicit High/Low from the model, else infer from the wording.
    const suggested: RequestPriority =
      priority.toLowerCase() === "high"
        ? "P1"
        : priority.toLowerCase() === "low"
          ? "P3"
          : suggestPriority(haystack, requestType);

    created.push(
      await createTicket({
        title,
        // Carry the AI's structured output into the ticket body rather than
        // dropping it — these are the fields a reviewer needs for context.
        description: [
          issueType && `Type: ${issueType}`,
          priority && `Priority: ${priority}`,
          due && `Target: ${due}`,
          assigneeName && `Owner named in meeting: ${assigneeName}`,
        ]
          .filter(Boolean)
          .join("\n"),
        whyScenario: "Raised in a MeetPilot meeting and approved through the human-in-the-loop AI review gate.",
        meetingId: params.id,
        assigneeId: match?.id ?? null,
        createdById: me.id,
        requestType,
        priority: suggested,
        source: "MEETING",
        systemId: matchedSystem?.id ?? null,
        requestedById: match?.id ?? null,
      })
    );
    alreadyOnThisMeeting.add(title.toLowerCase());
  }

  return NextResponse.json({ created: created.length, tickets: created }, { status: 201 });
}
