import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, inviteMember, listMembershipsByRole, logEmail } from "@/lib/db/store";
import { sendEmail } from "@/lib/email/resend";
import { inviteMemberEmail } from "@/lib/email/templates";
import { can, Role } from "@/lib/rbac";

// Admin "Add member" action — creates a real User with a different email
// than the person doing the inviting, then emails them a temp password.
// This is deliberately separate from /api/auth/register (self-signup): only
// an ORG_ADMIN can call this, and it can add someone who never visits the
// signup page themselves.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await findUserByEmail(session.user.email);
  const roleByUser = me ? await listMembershipsByRole() : {};
  const myRole = (me && roleByUser[me.id]) as Role | undefined;
  if (!myRole || !can(myRole, "org:manage_members")) {
    return NextResponse.json({ error: "Forbidden — only Org Admins can add members" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { name, email, role } = body ?? {};
  if (!name || !email || !role) {
    return NextResponse.json({ error: "name, email, and role are required" }, { status: 400 });
  }

  let created;
  try {
    created = await inviteMember({ name, email, role });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add member" },
      { status: 409 }
    );
  }

  const { subject, html } = inviteMemberEmail({
    inviteeName: created.user.email,
    orgName: "Acme Industries",
    invitedByName: me?.name ?? "An admin",
    role,
    tempPassword: created.tempPassword,
    loginUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000/login",
  });
  const result = await sendEmail({ to: created.user.email, subject, html });
  await logEmail({
    toEmail: created.user.email,
    type: "invite_member",
    status: result.ok ? "SENT" : "FAILED",
    errorMessage: result.error,
  });

  return NextResponse.json(
    {
      id: created.user.id,
      email: created.user.email,
      name: created.user.name,
      emailSent: result.ok,
      emailError: result.ok ? undefined : result.error,
      // Only returned so the admin can hand it over manually if the email
      // send failed (e.g. Resend not configured yet) — never logged elsewhere.
      tempPassword: result.ok ? undefined : created.tempPassword,
    },
    { status: 201 }
  );
}
