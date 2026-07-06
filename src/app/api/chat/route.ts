import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, listChatMessages, listUsers, postChatMessage } from "@/lib/db/store";

// Team chat for the Slack-style side panel. GET returns the latest messages
// with sender name/id resolved; POST appends one. The client polls GET —
// fine at this scale; a production build would swap polling for Supabase
// Realtime or an SSE stream without changing this data model.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [messages, users] = await Promise.all([listChatMessages(), listUsers()]);
  const nameById = Object.fromEntries(users.map((u) => [u.id, u.name ?? u.email]));

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: nameById[m.userId] ?? "Unknown",
      text: m.text,
      createdAt: m.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });

  const message = await postChatMessage(me.id, text);
  return NextResponse.json(message, { status: 201 });
}
