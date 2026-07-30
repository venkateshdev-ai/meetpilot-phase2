"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, TextField } from "@/components/ui";
import type { DbGtmSystem } from "@/lib/db/store";
import {
  PRIORITY_LABELS,
  REQUEST_TYPE_LABELS,
  SLA_HOURS,
  type RequestPriority,
  type RequestType,
} from "@/lib/revops";

// Filing a request.
//
// The form used to collect a title and seven spec fields but no
// classification, so every manually filed request landed as an untyped P2
// against no system — which is exactly the information triage needs. Type,
// priority and system are now captured at intake, and the SLA implied by the
// chosen priority is shown before you commit to it.

const SPEC_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "description", label: "Description", placeholder: "What is happening, and what should happen instead?" },
  { key: "whyScenario", label: "Why (scenario)", placeholder: "What triggered this — who is blocked, and how badly?" },
  { key: "featureDescription", label: "Proposed change", placeholder: "What should be built or fixed?" },
  { key: "testCases", label: "Test cases", placeholder: "1. ...\n2. ..." },
  { key: "acceptanceCriteria", label: "Acceptance criteria", placeholder: "Given / When / Then, or a checklist" },
  { key: "telemetry", label: "Telemetry", placeholder: "Events to track once this ships" },
  { key: "successMetric", label: "Success metric", placeholder: "How will we know this worked?" },
];

function slaHint(priority: RequestPriority): string {
  const h = SLA_HOURS[priority];
  return h >= 48 ? `${Math.round(h / 24)} days to respond` : `${h} hours to respond`;
}

export default function NewRequestForm({ systems }: { systems: DbGtmSystem[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [requestType, setRequestType] = useState<RequestType>("CHANGE_REQUEST");
  const [priority, setPriority] = useState<RequestPriority>("P2");
  const [systemId, setSystemId] = useState<string>("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          requestType,
          priority,
          systemId: systemId || null,
          source: "DIRECT",
          ...fields,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not create the request");
        return;
      }
      router.push(`/tickets/${body.id}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectClass =
    "w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent-500";

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="One line — what needs to happen"
          required
        />

        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Type</span>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as RequestType)}
              className={selectClass}
            >
              {Object.entries(REQUEST_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as RequestPriority)}
              className={selectClass}
            >
              {(Object.keys(PRIORITY_LABELS) as RequestPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
            {/* Say what the priority commits the org to, at the point of choosing it. */}
            <span className="mt-1 block text-xs text-slate-500">{slaHint(priority)}</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">System</span>
            <select
              value={systemId}
              onChange={(e) => setSystemId(e.target.value)}
              className={selectClass}
            >
              <option value="">— not sure yet —</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {SPEC_FIELDS.map((f) => (
          <label key={f.key} className="mb-4 block">
            <span className="mb-1.5 block text-sm text-slate-300">{f.label}</span>
            <textarea
              rows={3}
              placeholder={f.placeholder}
              value={fields[f.key] ?? ""}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent-500"
            />
          </label>
        ))}

        {error && <p className="mb-3 text-xs text-danger">{error}</p>}
        <Button type="submit" disabled={submitting || !title.trim()}>
          {submitting ? "Filing…" : "File request"}
        </Button>
      </form>
    </Card>
  );
}
