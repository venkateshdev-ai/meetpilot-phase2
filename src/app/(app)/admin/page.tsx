import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, Badge } from "@/components/ui";
import { listRooms, listDesks, listVisitors } from "@/lib/mock/store";
import { findUserByEmail, listUsers, listMembershipsByRole } from "@/lib/db/store";
import { Role } from "@/lib/rbac";
import AdminMembersPanel from "./AdminMembersPanel";
import IntegrationsPanel from "./IntegrationsPanel";

// Members & roles and Integrations below are both real now (src/lib/db/store.ts
// + AdminMembersPanel.tsx / IntegrationsPanel.tsx). Rooms, desks, visitors, and
// audit log are still on the mock layer — that's Stage 8 scope, sequenced
// after MeetPilot core + the notification/AI-summary/ticketing work.
export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const me = await findUserByEmail(session.user.email);
  const [users, roleByUser] = await Promise.all([listUsers(), listMembershipsByRole()]);
  const viewerRole: Role = (me && (roleByUser[me.id] as Role)) || "GUEST";

  const members = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: (roleByUser[u.id] as Role) ?? "MEMBER",
  }));

  const rooms = listRooms();
  const desks = listDesks();
  const visitors = listVisitors();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Admin console</h1>
        <p className="text-sm text-slate-400">Members, roles, room inventory, and PM-tool integrations.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Members & roles</h2>
        <AdminMembersPanel members={members} viewerRole={viewerRole} />
      </section>

      <section id="settings">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          PM tool integrations
        </h2>
        <p className="mb-3 -mt-2 text-xs text-slate-500">
          Personal access token/API key connections — real ticket push + live ticket listing once connected.
          See .env.example for where to generate each credential.
        </p>
        <IntegrationsPanel />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Room inventory</h2>
        <Card className="divide-y divide-base-700 p-0">
          {rooms.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-slate-500">{r.floor} · {r.capacity} seats · ₹{r.tariffPerHour}/hr</div>
              </div>
              <Badge>Active</Badge>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Desk inventory</h2>
        <Card className="divide-y divide-base-700 p-0">
          {desks.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-medium">{d.label}</div>
                <div className="text-xs text-slate-500">{d.floor} · {d.zone}</div>
              </div>
              <Badge tone={d.isActive ? "neutral" : "danger"}>{d.isActive ? "Active" : "Out of service"}</Badge>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Visitor log</h2>
        <Card className="divide-y divide-base-700 p-0">
          {visitors.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-medium">{v.name}</div>
                <div className="text-xs text-slate-500">{v.purpose}</div>
              </div>
              <Badge tone={v.status === "CHECKED_IN" ? "success" : v.status === "CANCELLED" ? "danger" : "neutral"}>
                {v.status.replace("_", " ")}
              </Badge>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Audit log</h2>
        <Card className="text-sm text-slate-400">
          Varan connected Linear · Hulk updated Batman's role to Team Lead · Varan created "Sprint Sync"
        </Card>
      </section>
    </div>
  );
}
