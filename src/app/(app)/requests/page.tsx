import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  findUserByEmail,
  listTicketsForOrg,
  listGtmSystems,
  listUsers,
  listMembershipsByRole,
} from "@/lib/db/store";
import { can, Role } from "@/lib/rbac";
import { Button } from "@/components/ui";
import RequestQueue from "./RequestQueue";

// The RevOps request queue: every request against a revenue system, ordered by
// what actually needs attention next (breached SLA → priority → soonest due).
export default async function RequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const [me, tickets, systems, users, roleByUser] = await Promise.all([
    findUserByEmail(session.user.email),
    listTicketsForOrg(),
    listGtmSystems(),
    listUsers(),
    listMembershipsByRole(),
  ]);

  const role = (me ? roleByUser[me.id] : undefined) as Role | undefined;
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight">Request queue</h1>
          <p className="text-sm text-slate-400">
            Every request against a revenue system — captured in meetings, filed directly, or raised by a
            monitor. Ordered by what needs attention next.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/systems">
            <Button variant="secondary">Systems</Button>
          </Link>
          <Link href="/tickets/new">
            <Button>+ New request</Button>
          </Link>
        </div>
      </div>

      <RequestQueue
        tickets={tickets}
        systems={systems}
        usersById={usersById}
        canTriage={!!role && can(role, "request:triage")}
      />
    </div>
  );
}
