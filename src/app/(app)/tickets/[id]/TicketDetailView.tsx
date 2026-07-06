"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Send } from "lucide-react";
import { Card, Badge, Button, TextField, Modal } from "@/components/ui";
import type { DbTicket } from "@/lib/db/store";

const FIELDS: { key: keyof DbTicket; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "whyScenario", label: "Possible why (scenario)" },
  { key: "featureDescription", label: "Feature description" },
  { key: "testCases", label: "Test cases" },
  { key: "acceptanceCriteria", label: "Acceptance criteria" },
  { key: "telemetry", label: "Possible telemetry" },
  { key: "successMetric", label: "Success metric" },
];

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  OPEN: "neutral",
  IN_PROGRESS: "warning",
  DONE: "success",
  BLOCKED: "danger",
};

export default function TicketDetailView({ ticket: initial }: { ticket: DbTicket }) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, (initial as any)[f.key] ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushing, setPushing] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, ...values }),
    });
    if (res.ok) {
      const updated = await res.json();
      setTicket(updated);
      setSaved(true);
    }
    setSaving(false);
  }

  async function handleStatusChange(status: string) {
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setTicket(await res.json());
  }

  async function handlePush(provider: "JIRA" | "ASANA" | "TRELLO" | "SLACK") {
    setPushing(provider);
    setPushError(null);
    const res = await fetch(`/api/tickets/${ticket.id}/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPushError(body.error ?? "Push failed");
    } else {
      setTicket(body);
      setPushModalOpen(false);
    }
    setPushing(null);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 flex items-center justify-between">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-2xl font-bold outline-none"
        />
        <select
          value={ticket.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="ml-3 shrink-0 rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-slate-200"
        >
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="DONE">Done</option>
          <option value="BLOCKED">Blocked</option>
        </select>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <Badge tone={STATUS_TONE[ticket.status]}>{ticket.status.replace("_", " ")}</Badge>
        {ticket.provider && ticket.externalUrl ? (
          <a
            href={ticket.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-accent-400 hover:underline"
          >
            <ExternalLink size={12} /> {ticket.provider} · {ticket.externalId}
          </a>
        ) : (
          <span className="text-xs text-slate-500">Not pushed to any tool yet</span>
        )}
      </div>

      <Card>
        {FIELDS.map((f) => (
          <label key={f.key} className="mb-4 block">
            <span className="mb-1.5 block text-sm text-slate-300">{f.label}</span>
            <textarea
              rows={3}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent-500"
            />
          </label>
        ))}
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="secondary" onClick={() => setPushModalOpen(true)}>
            <span className="flex items-center gap-1.5">
              <Send size={13} /> Push to tool
            </span>
          </Button>
          {saved && <span className="text-xs text-emerald-400">Saved</span>}
        </div>
      </Card>

      <Modal open={pushModalOpen} onClose={() => setPushModalOpen(false)} title="Push ticket">
        <p className="mb-4 text-sm text-slate-400">
          Sends the fields above, formatted into the target tool's description, to whichever tool you connected in
          Admin &gt; Integrations. If it isn't connected yet, this will error and tell you so.
        </p>
        {pushError && <p className="mb-3 text-xs text-danger">{pushError}</p>}
        <div className="flex flex-col gap-2">
          {(["JIRA", "ASANA", "TRELLO", "SLACK"] as const).map((tool) => (
            <button
              key={tool}
              disabled={!!pushing}
              onClick={() => handlePush(tool)}
              className="rounded-xl border border-base-700 px-4 py-3 text-left text-sm hover:border-accent-500 hover:bg-accent-500/10 disabled:opacity-50"
            >
              {pushing === tool ? "Pushing…" : `Push to ${tool[0]}${tool.slice(1).toLowerCase()}`}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
