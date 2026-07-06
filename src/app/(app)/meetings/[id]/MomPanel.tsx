"use client";

import { useState } from "react";
import { Pencil, Share2, Check, Loader2 } from "lucide-react";
import { Card, Button, Avatar } from "@/components/ui";
import type { DbActionItem, DbUser } from "@/lib/db/store";

function colorFor(id: string) {
  const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export interface MomPanelProps {
  meetingId: string;
  meetingTitle: string;
  initialAgenda: string[];
  initialDiscussedItems: string[];
  actionItems: DbActionItem[];
  usersById: Record<string, DbUser>;
  onActionItemUpdated: (item: DbActionItem) => void;
}

// The in-call MoM (minutes of meeting) side panel from the FRD's "MoM Window
// side" wireframe: Agenda, Discussion Items, and Action Items with a Done
// toggle + assignee, editable while the call is running, with Save (persists
// notes) and Share (copies formatted notes) — both confirmed by a toast.
export default function MomPanel({
  meetingId, meetingTitle, initialAgenda, initialDiscussedItems, actionItems, usersById, onActionItemUpdated,
}: MomPanelProps) {
  const [agendaText, setAgendaText] = useState(initialAgenda.join("\n"));
  const [discussedText, setDiscussedText] = useState(initialDiscussedItems.join("\n"));
  const [editingAgenda, setEditingAgenda] = useState(false);
  const [editingDiscussed, setEditingDiscussed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }

  const agendaLines = agendaText.split("\n").filter(Boolean);
  const discussedLines = discussedText.split("\n").filter(Boolean);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agenda: agendaLines.join("\n"), discussedItems: discussedLines }),
      });
      if (res.ok) {
        setEditingAgenda(false);
        setEditingDiscussed(false);
        showToast("Saved successfully!");
      } else {
        showToast("Could not save notes");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    const notes = [
      `${meetingTitle} — meeting notes`,
      "",
      "Agenda:",
      ...agendaLines.map((l) => `  • ${l}`),
      "",
      "Discussed items:",
      ...discussedLines.map((l) => `  • ${l}`),
      "",
      "Action items:",
      ...actionItems.map((a) => {
        const assignee = a.assigneeId ? usersById[a.assigneeId]?.name : null;
        return `  • [${a.status === "DONE" ? "x" : " "}] ${a.description}${assignee ? ` — ${assignee}` : ""}`;
      }),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(notes);
      showToast("Shared successfully!");
    } catch {
      showToast("Could not copy notes");
    }
  }

  async function handleToggle(item: DbActionItem) {
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: item.status === "DONE" ? "OPEN" : "DONE" }),
      });
      if (res.ok) onActionItemUpdated(await res.json());
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <Card className="relative flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Meeting notes (MoM)</h4>
        <Button variant="secondary" onClick={handleShare}>
          <span className="flex items-center gap-1.5"><Share2 size={13} /> Share</span>
        </Button>
      </div>

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Agenda</h5>
          <button onClick={() => setEditingAgenda((v) => !v)} className="text-slate-500 hover:text-white">
            <Pencil size={13} />
          </button>
        </div>
        {editingAgenda ? (
          <textarea
            rows={3}
            value={agendaText}
            onChange={(e) => setAgendaText(e.target.value)}
            placeholder="One agenda point per line"
            className="w-full rounded-xl border border-base-700 bg-base-900 px-3 py-2 text-sm text-white outline-none focus:border-accent-500"
          />
        ) : agendaLines.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {agendaLines.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No agenda yet — click the pencil to add one.</p>
        )}
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Discussion items</h5>
          <button onClick={() => setEditingDiscussed((v) => !v)} className="text-slate-500 hover:text-white">
            <Pencil size={13} />
          </button>
        </div>
        {editingDiscussed ? (
          <textarea
            rows={4}
            value={discussedText}
            onChange={(e) => setDiscussedText(e.target.value)}
            placeholder="One discussed point per line"
            className="w-full rounded-xl border border-base-700 bg-base-900 px-3 py-2 text-sm text-white outline-none focus:border-accent-500"
          />
        ) : discussedLines.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {discussedLines.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nothing recorded yet — click the pencil to take notes.</p>
        )}
      </section>

      <section className="flex-1">
        <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Action items</h5>
        {actionItems.length === 0 ? (
          <p className="text-sm text-slate-500">No action items yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {actionItems.map((item) => {
              const assignee = item.assigneeId ? usersById[item.assigneeId] : undefined;
              const done = item.status === "DONE";
              return (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={`min-w-0 flex-1 ${done ? "text-slate-500 line-through" : "text-slate-300"}`}>
                    {item.description}
                    {item.dueDate && (
                      <span className="ml-1 text-xs text-slate-500">
                        — {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <button
                      role="switch"
                      aria-checked={done}
                      disabled={togglingId === item.id}
                      onClick={() => handleToggle(item)}
                      title={done ? "Mark as open" : "Mark as done"}
                      className={`relative h-5 w-9 rounded-full transition disabled:opacity-50 ${
                        done ? "bg-emerald-500" : "bg-base-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                          done ? "left-[18px]" : "left-0.5"
                        }`}
                      />
                    </button>
                    {assignee && (
                      <Avatar name={assignee.name ?? assignee.email} color={colorFor(assignee.id)} size={20} />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Button onClick={handleSave} disabled={saving} className="w-full justify-center">
        <span className="flex items-center gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? "Saving…" : "Save"}
        </span>
      </Button>

      {toast && (
        <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-base-900 px-4 py-2 text-sm text-emerald-400 shadow-lg">
          <Check size={14} /> {toast}
        </div>
      )}
    </Card>
  );
}
