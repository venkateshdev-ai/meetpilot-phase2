import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMeeting, createInstantMeeting, importOpenActionItemsFromPrevious } from "@/lib/db/store";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  // Google Meet / Zoom style "start an instant meeting" — no form fields,
  // meeting starts now and the creator lands straight in the call.
  if (body?.instant) {
    const meeting = await createInstantMeeting(userId);
    return NextResponse.json(meeting, { status: 201 });
  }

  const { title, type, agenda, startTime, endTime, participantIds, importPrevActionItems } = body ?? {};
  if (!title || !type || !startTime || !endTime) {
    return NextResponse.json({ error: "title, type, startTime, endTime are required" }, { status: 400 });
  }

  const meeting = await createMeeting({
    title,
    type,
    agenda: agenda ?? "",
    startTime,
    endTime,
    createdById: userId,
    participantIds: participantIds ?? [],
  });

  // FRD: "Action item import from previous meet" toggle — carry the previous
  // meeting's open action items into this one for follow-up.
  if (importPrevActionItems) {
    await importOpenActionItemsFromPrevious(meeting);
  }

  return NextResponse.json(meeting, { status: 201 });
}
