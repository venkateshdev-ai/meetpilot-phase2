"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, DoorOpen, Layers } from "lucide-react";
import { Card, Button, TextField, Avatar, Badge } from "@/components/ui";
import type { DbUser } from "@/lib/db/store";

type MeetingKind = "ONLINE" | "OFFLINE" | "HYBRID";

function colorFor(id: string) {
  const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function CreateMeetingForm({ users }: { users: DbUser[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<MeetingKind>("ONLINE");
  const [title, setTitle] = useState("Product Roadmap Review");
  const [start, setStart] = useState("2026-07-08T10:00");
  const [end, setEnd] = useState("2026-07-08T10:45");
  const [agenda, setAgenda] = useState("Review Q3 roadmap priorities\nDiscuss resourcing gaps");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    users.slice(0, 2).map((u) => u.id)
  );
  const [importPrevActionItems, setImportPrevActionItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleParticipant(id: string) {
    setSelectedParticipants((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          type: kind,
          agenda,
          startTime: new Date(start).toISOString(),
          endTime: new Date(end).toISOString(),
          participantIds: selectedParticipants,
          importPrevActionItems,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create meeting");
      }
      const meeting = await res.json();
      router.push(`/meetings/${meeting.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Create meeting</h1>
      <p className="mb-6 text-sm text-slate-400">
        Choose online, offline, or hybrid — MeetPilot handles scheduling either way.
      </p>

      <div className="mb-6 flex rounded-2xl border border-base-700 p-1">
        {(
          [
            { key: "ONLINE", label: "Online", icon: Video },
            { key: "OFFLINE", label: "Offline (In-person)", icon: DoorOpen },
            { key: "HYBRID", label: "Hybrid", icon: Layers },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setKind(opt.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition ${
              kind === opt.key ? "bg-brand-gradient text-white" : "text-slate-400"
            }`}
          >
            <opt.icon size={16} />
            {opt.label}
          </button>
        ))}
      </div>

      <Card className="mb-6">
        <TextField label="Meeting title" placeholder="Sprint planning" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="mb-4 grid grid-cols-2 gap-4">
          <TextField label="Start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          <TextField label="End" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm text-slate-300">Agenda</span>
          <textarea
            rows={3}
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            className="w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent-500"
          />
        </label>

        <span className="mb-2 block text-sm text-slate-300">Participants</span>
        <div className="mb-4 flex flex-wrap gap-2">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => toggleParticipant(u.id)}
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition ${
                selectedParticipants.includes(u.id)
                  ? "border-accent-500 bg-accent-500/15 text-accent-400"
                  : "border-base-700 text-slate-400"
              }`}
            >
              <Avatar name={u.name ?? u.email} color={colorFor(u.id)} size={18} />
              {u.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-base-700 bg-base-900 px-3.5 py-2.5">
          <div>
            <div className="text-sm text-slate-300">Import action items from previous meet</div>
            <div className="text-xs text-slate-500">
              Carries open action items from this group's last meeting into the new one for follow-up.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={importPrevActionItems}
            onClick={() => setImportPrevActionItems((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
              importPrevActionItems ? "bg-accent-500" : "bg-base-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                importPrevActionItems ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </Card>

      {(kind === "ONLINE" || kind === "HYBRID") && (
        <Card className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-accent-500/15 p-2 text-accent-400">
              <Video size={18} />
            </span>
            <div>
              <div className="text-sm font-medium">Video call link</div>
              <div className="text-xs text-slate-500">A live video room is created automatically when you send the invite</div>
            </div>
          </div>
          <Badge tone="accent">Auto-generated</Badge>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </div>
  );
}
