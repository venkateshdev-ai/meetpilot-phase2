import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, listMembershipsByRole, type DbUser } from "@/lib/db/store";
import { can, ROLE_LABELS, type Permission, type Role } from "@/lib/rbac";

// One place to resolve "who is calling and may they do this".
//
// rbac.ts declared eight permissions but only two were ever checked — the
// others existed as documentation of an intent nobody enforced. Route handlers
// each rolled their own session→user→role lookup, which is why adding a check
// was easy to skip. This makes the guarded path the shortest one to write.

export interface Caller {
  user: DbUser;
  role: Role;
}

/** Resolve the signed-in caller and their org role, or null if not signed in. */
export async function getCaller(): Promise<Caller | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await findUserByEmail(session.user.email);
  if (!user) return null;
  const roleByUser = await listMembershipsByRole();
  const role = roleByUser[user.id] as Role | undefined;
  if (!role) return null;
  return { user, role };
}

/**
 * Guard a route handler. Returns either the caller or a ready-to-return
 * response, so a handler reads:
 *
 *   const auth = await requirePermission("meeting:create");
 *   if ("response" in auth) return auth.response;
 *   // ...use auth.caller
 */
export async function requirePermission(
  permission: Permission
): Promise<{ caller: Caller } | { response: NextResponse }> {
  const caller = await getCaller();
  if (!caller) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (!can(caller.role, permission)) {
    return {
      response: NextResponse.json(
        {
          error: `Forbidden — the ${ROLE_LABELS[caller.role]} role cannot perform this action (${permission}).`,
        },
        { status: 403 }
      ),
    };
  }
  return { caller };
}
