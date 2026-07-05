"use client";

import { useState } from "react";
import { Card, Badge, Avatar, Button } from "@/components/ui";
import { listUsers, listIntegrations, listRooms, listDesks, listVisitors } from "@/lib/mock/store";
import { can, Role } from "@/lib/rbac";

// This whole page is the module the PRD flagged as completely missing from
// the original wireframes/Figma (Section 5: "User profile with roles" and
// "Admin / workspace settings" both had zero screen coverage before).
export default function AdminPage() {
  const users = listUsers();
  const integrations = listIntegrations();
  const rooms = listRooms();
  const desks = listDesks();
  const visitors = listVisitors();
  const [connected, setConnected] = useState<Record<string, boolean>>(
    Object.fromEntries(integrations.map((i) => [i.provider, i.connected]))
  );
  const viewerRole: Role = "ORG_ADMIN"; // demo user is org admin

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Admin console</h1>
        <p className="text-sm text-slate-400">Members, roles, room inventory, and PM-tool integrations.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Members & roles</h2>
        <Card className="divide-y divide-base-700 p-0">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} color={u.avatarColor} size={32} />
                <div>
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
              </div>
              <select
                defaultValue={u.role}
                disabled={!can(viewerRole, "org:manage_members")}
                className="rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="ORG_ADMIN">Org Admin</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="MEMBER">Member</option>
                <option value="GUEST">Guest</option>
              </select>
            </div>
          ))}
        </Card>
      </section>

      <section id="settings">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Integrations & connected apps (OAuth 2.0)
        </h2>
        <p className="mb-3 -mt-2 text-xs text-slate-500">
          PM tools, calendar sync, team chat, CRM logging, and payments — each connection is a per-org OAuth grant.
        </p>
        <Card className="divide-y divide-base-700 p-0">
          {integrations.map((i) => (
            <div key={i.provider} className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm font-medium">{i.provider}</div>
                <div className="text-xs text-slate-500">
                  {connected[i.provider] ? `Connected by ${i.connectedBy} on ${i.connectedAt}` : "Not connected"}
                </div>
              </div>
              {connected[i.provider] ? (
                <Badge tone="success">Connected</Badge>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setConnected((p) => ({ ...p, [i.provider]: true }))}
                >
                  Connect
                </Button>
              )}
            </div>
          ))}
        </Card>
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
