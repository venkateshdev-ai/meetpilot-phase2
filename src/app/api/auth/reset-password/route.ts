import { NextResponse } from "next/server";
import { consumePasswordResetToken, setUserPassword } from "@/lib/db/store";

// Complete a password reset. The token is single-use and expires after an
// hour; consumePasswordResetToken burns it before the password is written, so
// a replayed request cannot set the password a second time.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "").trim();
  const password = String(body?.password ?? "");

  if (!token) return NextResponse.json({ error: "Missing reset token" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 422 });
  }

  const user = await consumePasswordResetToken(token);
  if (!user) {
    // Unknown, expired and already-used all collapse into one message on
    // purpose — distinguishing them would leak which tokens are real.
    return NextResponse.json(
      { error: "That reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  await setUserPassword(user.id, password);
  return NextResponse.json({ ok: true });
}
