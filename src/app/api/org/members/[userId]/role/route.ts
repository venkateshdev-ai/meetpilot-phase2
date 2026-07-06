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
    return NextResponse.json({ error: "Forbidden — only Org Admins can change roles" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const role = body?.role;
  if (!["ORG_ADMIN", "TEAM_LEAD", "MEMBER", "GUEST"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  await updateMemberRole(params.userId, role);
  return NextResponse.json({ ok: true });
}
