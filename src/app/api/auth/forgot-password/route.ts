import { NextResponse } from "next/server";
import { findUserByEmail, createPasswordResetToken, logEmail } from "@/lib/db/store";
import { sendEmail } from "@/lib/email/resend";

// Start a password reset.
//
// Two deliberate behaviours:
//
// 1. The response never reveals whether an account exists. Returning "no such
//    user" would turn this endpoint into an account-enumeration oracle.
// 2. If outbound email is not configured, we say so plainly rather than
//    claiming a link was sent. The previous version of this screen always
//    reported success and never sent anything, which left a locked-out user
//    waiting for an email that could not arrive.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const emailConfigured = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  const user = await findUserByEmail(email);

  // Do the work only for a real account, but keep the response shape identical.
  if (user) {
    const token = await createPasswordResetToken(user.id);
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const link = `${base}/reset-password?token=${token}`;

    if (emailConfigured) {
      const result = await sendEmail({
        to: user.email,
        subject: "Reset your MeetPilot password",
        html: `<p>Someone requested a password reset for your MeetPilot account.</p>
               <p><a href="${link}">Choose a new password</a> — this link expires in one hour and can be used once.</p>
               <p>If this wasn't you, you can ignore this email; nothing has changed.</p>`,
      });
      await logEmail({
        toEmail: user.email,
        type: "PASSWORD_RESET",
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.error,
      });
    } else {
      // Dev/self-hosted without a mail provider: log the link server-side so
      // the operator can still complete a reset, and tell the user the truth.
      console.warn(`[auth] email not configured — password reset link for ${user.email}: ${link}`);
    }
  }

  return NextResponse.json({
    ok: true,
    emailConfigured,
    message: emailConfigured
      ? "If an account exists for that address, a reset link is on its way."
      : "Email delivery isn't configured on this deployment, so no link can be sent. Ask an administrator to reset your password.",
  });
}
