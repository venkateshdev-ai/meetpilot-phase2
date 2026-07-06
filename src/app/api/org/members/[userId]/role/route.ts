import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, listMembershipsByRole, updateMemberRole } from "@/lib/db/store";
import { can, Role } from "@/lib/rbac";

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const me = await findUserByEmail(session.user.email);
  const roleByUser = me ? await listMembershipsByRole() : {};
  const myRole = (me && roleByUser[me.id]) as Role | undefined;
  if (!myRole || !can(myRole, "org:manage_members")) {
    return NextResponse.json({ error: "Forbidden — Reviewers cannot change roles" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role;
  if (!["GLOBAL_ADMIN", "ADMIN", "REVIEWER"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Granting or revoking Global Admin — and touching an existing Global
  // Admin's role at all — requires the org:manage_admins permission (Global
  // Admins only); a plain Admin manages only Admins/Reviewers.
  const targetRole = roleByUser[params.userId] as Role | undefined;
  if ((role === "GLOBAL_ADMIN" || targetRole === "GLOBAL_ADMIN") && !can(myRole, "org:manage_admins")) {
    return NextResponse.json({ error: "Forbidden — only a Global Admin can manage Global Admins" }, { status: 403 });
  }

  await updateMemberRole(params.userId, role);
  return NextResponse.json({ ok: true });
}
