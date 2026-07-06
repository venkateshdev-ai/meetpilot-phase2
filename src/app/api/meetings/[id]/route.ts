import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMeeting, saveMeetingNotes } from "@/lib/db/store";

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
