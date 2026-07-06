"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Avatar, Button, TextField } from "@/components/ui";
import { can, Role, ROLE_LABELS } from "@/lib/rbac";

function colorFor(id: string) {
  const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: Role;
}

// Real user management: role changes hit PATCH /api/org/members/[id]/role,
// "Add user" hits POST /api/org/members (creates a real User and sends a real
// invite email via Resend with a temp password). Reviewers see the list
// read-only — no add button, no role dropdowns (enforced server-side too).
// Only a Global Admin can grant or revoke the Global Admin role.
export default function UsersPanel({
  members,
  viewerRole,
}: {
  members: Member[];
  viewerRole: Role;
}) {
  const router = useRouter();
  const canManage = can(viewerRole, "org:manage_members");
  const canManageAdmins = can(viewerRole, "org:manage_admins");
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("REVIEWER");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const assignableRoles: Role[] = canManageAdmins ? ["GLOBAL_ADMIN", "ADMIN", "REVIEWER"] : ["ADMIN", "REVIEWER"];

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const res = await fetch("/api/org/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setResult({ ok: false, message: body.error ?? "Could not add user" });
      setSubmitting(false);
      return;
    }

    if (body.emailSent) {
      setResult({ ok: true, message: `Invite email sent to ${email}.` });
    } else {
      setResult({
        ok: true,
        message: `User created, but the invite email failed to send (${body.emailError ?? "no email provider configured"}). Temp password: ${body.tempPassword}`,
      });
    }
    setName("");
    setEmail("");
    setRole("REVIEWER");
    setSubmitting(false);
    router.refresh();
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    await fetch(`/api/org/members/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    router.refresh();
  }

  return (
    <div>
      <Card className="divide-y divide-base-700 p-0">
        {members.map((u) => {
          // An Admin can't touch Global Admins — that requires org:manage_admins.
          const rowLocked = !canManage || (u.role === "GLOBAL_ADMIN" && !canManageAdmins);
          return (
            <div key={u.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Avatar name={u.name ?? u.email} color={colorFor(u.id)} size={32} />
                <div>
                  <div className="text-sm font-medium">{u.name ?? u.email}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
              </div>
              {rowLocked ? (
                <span className="rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-slate-400">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              ) : (
                <select
                  defaultValue={u.role}
                  onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                  className="rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-slate-200"
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </Card>

      {canManage && (
        <div className="mt-4">
          {!showAddForm ? (
            <Button variant="secondary" onClick={() => setShowAddForm(true)}>
              + Add user
            </Button>
          ) : (
            <Card>
              <form onSubmit={handleAddMember} className="space-y-3">
                <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
                <TextField
                  label="Work email"
                  type="email"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-slate-200"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                {result && (
                  <p className={`text-xs ${result.ok ? "text-emerald-400" : "text-danger"}`}>{result.message}</p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Adding…" : "Add & send invite"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
