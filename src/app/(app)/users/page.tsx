import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { findUserByEmail, listUsers, listMembershipsByRole } from "@/lib/db/store";
import { Role, ROLE_LABELS } from "@/lib/rbac";
import UsersPanel from "./UsersPanel";

// Standalone user management (split out of the old Admin console).
// Global Admins manage everyone, Admins manage non-admin users,
// Reviewers get a read-only view.
export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const me = await findUserByEmail(session.user.email);
  const [users, roleByUser] = await Promise.all([listUsers(), listMembershipsByRole()]);
  const viewerRole: Role = (me && (roleByUser[me.id] as Role)) || "REVIEWER";

  const members = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: (roleByUser[u.id] as Role) ?? "REVIEWER",
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold">User management</h1>
        <p className="text-sm text-slate-400">
          Roles: Global Admin (full control), Admin (manages users & integrations), Reviewer (read-only for
          users). You are signed in as {ROLE_LABELS[viewerRole]}.
        </p>
      </div>
      <UsersPanel members={members} viewerRole={viewerRole} />
    </div>
  );
}
