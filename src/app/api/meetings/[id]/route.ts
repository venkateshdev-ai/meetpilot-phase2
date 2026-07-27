import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMeeting, saveMeetingNotes, deleteMeeting } from "@/lib/db/store";
import { requirePermission } from "@/lib/authz";

// Saves the MoM side-panel edits (FRD "MoM Window side"): agenda +
// discussed items. Action items are toggled individually via
// PATCH /api/action-items/[id].
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const meeting = await getMeeting(params.id);
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const agenda = typeof body?.agenda === "string" ? body.agenda : meeting.agenda ?? "";
  const discussedItems = Array.isArray(body?.discussedItems)
    ? body.discussedItems.filter((d: unknown): d is string => typeof d === "string")
    : [];

  await saveMeetingNotes(params.id, { agenda, discussedItems });
  return NextResponse.json({ ok: true });
}

// Delete a meeting. meeting:delete was declared in rbac.ts from the start but
// there was no endpoint behind it, so the permission could never be exercised
// and a mis-created meeting could not be removed.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission("meeting:delete");
  if ("response" in auth) return auth.response;

  try {
    await deleteMeeting(params.id, auth.caller.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 500 });
  }
}
