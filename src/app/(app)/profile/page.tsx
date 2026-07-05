import { Card, Badge, Avatar, TextField, Button } from "@/components/ui";
import { getCurrentUser, listActionItemsForUser, getMeeting } from "@/lib/mock/store";

export default function ProfilePage() {
  const user = getCurrentUser();
  const myActions = listActionItemsForUser(user.id);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Profile</h1>

      <Card className="mb-6 flex items-center gap-4">
        <Avatar name={user.name} color={user.avatarColor} size={56} />
        <div>
          <div className="text-lg font-semibold">{user.name}</div>
          <div className="text-sm text-slate-400">{user.email}</div>
          <Badge tone="accent">{user.role.replace("_", " ")}</Badge>
        </div>
      </Card>

      <Card className="mb-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Account details</h3>
        <TextField label="Full name" defaultValue={user.name} />
        <TextField label="Email" defaultValue={user.email} type="email" />
        <Button variant="secondary">Save changes</Button>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
          My action items across all meetings
        </h3>
        <div className="flex flex-col divide-y divide-base-700">
          {myActions.map((a) => {
            const meeting = getMeeting(a.meetingId);
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
