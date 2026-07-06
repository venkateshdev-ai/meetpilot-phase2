import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMeeting } from "@/lib/db/store";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { title, type, agenda, startTime, endTime, participantIds, roomId } = body ?? {};
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
    roomId: roomId ?? null,
  });

  return NextResponse.json(meeting, { status: 201 });
}
