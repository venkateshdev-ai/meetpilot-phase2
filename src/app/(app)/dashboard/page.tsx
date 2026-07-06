import Link from "next/link";
import { getServerSession } from "next-auth";
import { Video, DoorOpen, Layers } from "lucide-react";
import { Card, Badge, Avatar, Button } from "@/components/ui";
import { authOptions } from "@/lib/auth";
import {
  getUpcomingMeetings, listUsers, listMeetings, getMeetingParticipantIds, listMembershipsByRole,
} from "@/lib/db/store";

const TYPE_ICON = { ONLINE: Video, OFFLINE: DoorOpen, HYBRID: Layers } as const;
const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const [session, upcoming, allMeetings, users, roleByUser] = await Promise.all([
    getServerSession(authOptions),
    getUpcomingMeetings(),
    listMeetings(),
    listUsers(),
    listMembershipsByRole(),
  ]);
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const recent = allMeetings.filter((m) => m.status === "COMPLETED");
  const participantsByMeeting = Object.fromEntries(
    await Promise.all(upcoming.map(async (m) => [m.id, await getMeetingParticipantIds(m.id)] as const))
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Good afternoon, {firstName}</h1>
            <p className="text-sm text-slate-400">Here's what's happening across Acme Industries.</p>
          </div>
          <Link href="/meetings/new">
            <Button>+ Create Meeting</Button>
          </Link>
        </div>

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Upcoming meetings
        </h2>
        <div className="mb-8 flex flex-col gap-3">
          {upcoming.length === 0 && (
            <Card className="text-sm text-slate-400">No upcoming meetings. Create one to get started.</Card>
          )}
          {upcoming.map((m) => {
            const Icon = TYPE_ICON[m.type];
            return (
              <Link key={m.id} href={`/meetings/${m.id}`}>
                <Card className="flex items-center justify-between transition hover:border-accent-500">
                  <div className="flex items-center gap-3">
                    <span className="rounded-xl bg-accent-500/15 p-2 text-accent-400">
                      <Icon size={18} />
                    </span>
                    <div>
                      <div className="font-medium">{m.title}</div>
                      <div className="text-xs text-slate-400">{formatTime(m.startTime)} · {m.type}</div>
                    </div>
                  </div>
                  <div className="flex -space-x-2">
                    {(participantsByMeeting[m.id] ?? []).slice(0, 4).map((id) => {
                      const u = users.find((x) => x.id === id);
                      if (!u) return null;
                      return <Avatar key={id} name={u.name ?? u.email} color={colorFor(u.id)} size={26} />;
                    })}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Recent meetings
        </h2>
        <div className="flex flex-col gap-3">
          {recent.map((m) => (
            <Link key={m.id} href={`/meetings/${m.id}`}>
              <Card className="flex items-center justify-between transition hover:border-accent-500">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-xs text-slate-400">{formatTime(m.startTime)}</div>
                </div>
                <Badge tone="success">Summary ready</Badge>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Team status</h2>
        <Card className="flex flex-col gap-4">
          {users.map((u) => {
            const role = roleByUser[u.id] ?? "MEMBER";
            return (
              <div key={u.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name ?? u.email} color={colorFor(u.id)} size={30} />
                  <div>
                    <div className="text-sm font-medium">{u.name}</div>
                    <div className="text-xs text-slate-500">{role.replace("_", " ")}</div>
                  </div>
                </div>
                <Badge tone={role === "ORG_ADMIN" ? "accent" : role === "TEAM_LEAD" ? "warning" : "neutral"}>
                  {role.replace("_", " ")}
                </Badge>
              </div>
            );
          })}
        </Card>

        <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Quick links
        </h2>
        <Card className="flex flex-col gap-2">
          <Link href="/rooms" className="text-sm text-accent-400 hover:underline">Browse meeting rooms →</Link>
          <Link href="/analytics" className="text-sm text-accent-400 hover:underline">View analytics →</Link>
          <Link href="/admin" className="text-sm text-accent-400 hover:underline">Manage members & integrations →</Link>
        </Card>
      </div>
    </div>
  );
}
