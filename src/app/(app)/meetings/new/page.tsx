"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, DoorOpen, Layers, Star } from "lucide-react";
import { Card, Button, TextField, Avatar, Badge } from "@/components/ui";
import { listUsers, listRooms } from "@/lib/mock/store";

type MeetingKind = "ONLINE" | "OFFLINE" | "HYBRID";

// This is the single flow the PRD's gap analysis (Section 5, "Book a meeting
// online or offline") calls for: one Create Meeting screen with a format
// toggle, instead of two disconnected products (a video scheduler and a
// separate room-booking kiosk app).
export default function CreateMeetingPage() {
  const router = useRouter();
  const users = listUsers();
  const rooms = listRooms();
  const [kind, setKind] = useState<MeetingKind>("ONLINE");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([users[0].id, users[1].id]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(rooms[0]?.id ?? null);

  function toggleParticipant(id: string) {
    setSelectedParticipants((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
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
            { key: "OFFLINE", label: "Offline (Room)", icon: DoorOpen },
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
        <TextField label="Meeting title" placeholder="Sprint planning" defaultValue="Product Roadmap Review" />
        <div className="mb-4 grid grid-cols-2 gap-4">
          <TextField label="Start" type="datetime-local" defaultValue="2026-07-08T10:00" />
          <TextField label="End" type="datetime-local" defaultValue="2026-07-08T10:45" />
        </div>
        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm text-slate-300">Agenda</span>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent-500"
            defaultValue={"Review Q3 roadmap priorities\nDiscuss resourcing gaps"}
          />
        </label>

        <span className="mb-2 block text-sm text-slate-300">Participants</span>
        <div className="mb-2 flex flex-wrap gap-2">
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
              <Avatar name={u.name} color={u.avatarColor} size={18} />
              {u.name}
            </button>
          ))}
        </div>
      </Card>

      {(kind === "ONLINE" || kind === "HYBRID") && (
        <Card className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-accent-500/15 p-2 text-accent-400">
              <Video size={18} />
            </span>
            <div>
              <div className="text-sm font-medium">Google Meet link</div>
              <div className="text-xs text-slate-500">Auto-generated when you send the invite</div>
            </div>
          </div>
          <Badge tone="accent">Auto-generated</Badge>
        </Card>
      )}

      {(kind === "OFFLINE" || kind === "HYBRID") && (
        <div className="mb-6">
          <span className="mb-2 block text-sm text-slate-300">Choose a room</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rooms.map((r) => (
              <Card
                key={r.id}
                onClick={() => setSelectedRoom(r.id)}
                className={`cursor-pointer transition ${selectedRoom === r.id ? "border-accent-500" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{r.name}</span>
                  <span className="flex items-center gap-1 text-xs text-warning">
                    <Star size={12} fill="currentColor" /> {r.rating}
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  {r.capacity} seats · {r.areaSqft} sqft · ₹{r.tariffPerHour}/hr
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.amenities.map((a) => (
                    <span key={a} className="rounded-full bg-base-700 px-2 py-0.5 text-[10px] text-slate-300">
                      {a}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          Cancel
        </Button>
        <Button onClick={() => router.push("/meetings/m_sprint_sync")}>Send invite</Button>
      </div>
    </div>
  );
}
