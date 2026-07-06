import { NextResponse } from "next/server";
import { findUserByEmail, createUserWithOrg, logEmail } from "@/lib/db/store";
import { sendEmail } from "@/lib/email/resend";
import { welcomeSignupEmail } from "@/lib/email/templates";

// Real signup: writes an actual User + OrgMembership row to the DB. There's
// no multi-org creation yet (see comment in store.ts:createUserWithOrg) — new
// signups join the seeded Acme org as a MEMBER, which matches the app's
// current single-tenant demo scope.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { name, email, password } = body ?? {};

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const user = await createUserWithOrg({ name, email, password, orgName: "Acme Industries" });

  // Best-effort welcome email — signup succeeds even if Resend isn't
  // configured yet or the send fails; we just log it either way.
  const { subject, html } = welcomeSignupEmail({ name: user.name ?? name, orgName: "Acme Industries" });
  const emailResult = await sendEmail({ to: user.email, subject, html });
  await logEmail({
    toEmail: user.email,
    type: "welcome_signup",
    status: emailResult.ok ? "SENT" : "FAILED",
    errorMessage: emailResult.error,
  });

  return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
}
