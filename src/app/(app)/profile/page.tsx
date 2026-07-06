import { getServerSession } from "next-auth";
import { Card, Badge, Avatar, TextField, Button } from "@/components/ui";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, listActionItemsForUser, getMeeting, listMembershipsByRole } from "@/lib/db/store";
import { Role, ROLE_LABELS } from "@/lib/rbac";

function colorFor(id: string) {
  const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const user = email ? await findUserByEmail(email) : undefined;

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="text-sm text-slate-400">Sign in to view your profile.</Card>
      </div>
    );
  }

  const [myActions, roleByUser] = await Promise.all([
    listActionItemsForUser(user.id),
    listMembershipsByRole(),
  ]);
  const role = (roleByUser[user.id] ?? "REVIEWER") as Role;
  const meetingsById = Object.fromEntries(
    await Promise.all(
      Array.from(new Set(myActions.map((a) => a.meetingId))).map(async (id) => [id, await getMeeting(id)] as const)
    )
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Profile</h1>

      <Card className="mb-6 flex items-center gap-4">
        <Avatar name={user.name ?? user.email} color={colorFor(user.id)} size={56} />
        <div>
          <div className="text-lg font-semibold">{user.name}</div>
          <div className="text-sm text-slate-400">{user.email}</div>
          <Badge tone="accent">{ROLE_LABELS[role] ?? role}</Badge>
        </div>
      </Card>

      <Card className="mb-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Account details</h3>
        <TextField label="Full name" defaultValue={user.name ?? ""} />
        <TextField label="Email" defaultValue={user.email} type="email" />
        <Button variant="secondary">Save changes</Button>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          My action items across all meetings
        </h3>
        <div className="flex flex-col divide-y divide-base-700">
          {myActions.length === 0 && (
            <div className="py-3 text-sm text-slate-400">No action items assigned to you yet.</div>
          )}
          {myActions.map((a) => {
            const meeting = meetingsById[a.meetingId];
            return (
              <div key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-sm">{a.description}</div>
                  <div className="text-xs text-slate-500">from {meeting?.title}</div>
                </div>
                <Badge tone={a.status === "DONE" ? "success" : "neutral"}>{a.status.replace("_", " ")}</Badge>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
