import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  findUserByEmail,
  listGtmSystems,
  listTicketsForOrg,
  listUsers,
  listMembershipsByRole,
} from "@/lib/db/store";
import { can, Role } from "@/lib/rbac";
import SystemsPanel from "./SystemsPanel";

export default async function SystemsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const [me, systems, tickets, users, roleByUser] = await Promise.all([
    findUserByEmail(session.user.email),
    listGtmSystems(),
    listTicketsForOrg(),
    listUsers(),
    listMembershipsByRole(),
  ]);

  const role = (me ? roleByUser[me.id] : undefined) as Role | undefined;
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Revenue systems</h1>
      <p className="mb-5 text-sm text-slate-400">
        The GTM systems MeetPilot governs requests for. Every request is filed against one, so ownership
        and impact are never ambiguous.
      </p>
      <SystemsPanel
        systems={systems}
        tickets={tickets}
        usersById={usersById}
        canManage={!!role && can(role, "system:manage")}
      />
    </div>
  );
}
