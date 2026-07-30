import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  getTicketById,
  listGtmSystems,
  listUsers,
  findUserByEmail,
  listMembershipsByRole,
} from "@/lib/db/store";
import { can, Role } from "@/lib/rbac";
import TriagePanel from "./TriagePanel";
import TicketDetailView from "./TicketDetailView";

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const [ticket, systems, users, me, roleByUser] = await Promise.all([
    getTicketById(params.id),
    listGtmSystems(),
    listUsers(),
    findUserByEmail(session.user.email),
    listMembershipsByRole(),
  ]);
  if (!ticket) notFound();

  const role = (me ? roleByUser[me.id] : undefined) as Role | undefined;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Triage first: priority, owner and SLA are what a queue owner opens
          this page to change. The spec fields below are the slower edit. */}
      <TriagePanel
        ticket={ticket}
        systems={systems}
        users={users}
        canTriage={!!role && can(role, "request:triage")}
      />
      <TicketDetailView ticket={ticket} />
    </div>
  );
}
