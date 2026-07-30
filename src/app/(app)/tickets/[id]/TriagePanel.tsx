"use client";

// Triage controls for a single request.
//
// POST /api/tickets/[id]/triage existed but the only way to reach it from the
// UI was the queue's "Escalate to P0" shortcut. Everything else the endpoint
// supports — type, owning system, assignee, status — had no control at all,
// so a request could be filed but never properly triaged in the product.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { Card, Badge, Button } from "@/components/ui";
import type { DbTicket, DbGtmSystem, DbUser } from "@/lib/db/store";
import {
  PRIORITY_LABELS,
  PRIORITY_TONE,
  REQUEST_TYPE_LABELS,
  SLA_HOURS,
  SOURCE_LABELS,
  slaState,
  type RequestPriority,
  type RequestType,
} from "@/lib/revops";

const STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export default function TriagePanel({
  ticket: initial,
  systems,
  users,
  canTriage,
}: {
  ticket: DbTicket;
  systems: DbGtmSystem[];
  users: DbUser[];
  canTriage: boolean;
}) {
  const router = useRouter();
  const [ticket, setTicket] = useState(initial);
  const [requestType, setRequestType] = useState<RequestType>(initial.requestType);
  const [priority, setPriority] = useState<RequestPriority>(initial.priority);
  const [systemId, setSystemId] = useState(initial.systemId ?? "");
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId ?? "");
  const [status, setStatus] = useState<string>(initial.status);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sla = slaState(ticket.slaDueAt, ticket.priority, ticket.resolvedAt);
  const dirty =
    requestType !== ticket.requestType ||
    priority !== ticket.priority ||
    (systemId || null) !== ticket.systemId ||
    (assigneeId || null) !== ticket.assigneeId ||
    status !== ticket.status;

  async function apply() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType,
          priority,
          systemId: systemId || null,
          assigneeId: assigneeId || null,
          status,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setTicket(body);
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(body.error ?? `Failed (HTTP ${res.status})`);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "w-full rounded-xl border border-base-700 bg-base-900 px-3 py-2 text-sm text-white outline-none focus:border-accent-500 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={15} className="text-accent-400" /> Triage
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
          <Badge tone="neutral">{SOURCE_LABELS[ticket.source]}</Badge>
          {ticket.triagedAt ? (
            <Badge tone="success">Triaged</Badge>
          ) : (
            <Badge tone="warning">Needs triage</Badge>
          )}
        </div>
      </div>

      {/* SLA state, stated plainly — this is the commitment the org has made. */}
      {sla && (
        <div
          className={clsx(
            "mb-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm",
            ticket.status === "DONE"
              ? "border-base-700 text-slate-400"
              : sla.breached
                ? "border-danger/40 bg-danger/5 text-danger"
                : sla.atRisk
                  ? "border-warning/40 bg-warning/5 text-warning"
                  : "border-base-700 text-slate-300"
          )}
        >
          {ticket.status !== "DONE" && sla.breached ? <AlertTriangle size={15} /> : <Clock size={15} />}
          <span>
            {sla.label}
            {ticket.slaDueAt && (
              <span className="ml-1 text-xs opacity-70">
                (due {new Date(ticket.slaDueAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })})
              </span>
            )}
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs text-slate-400">Type</span>
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as RequestType)}
            disabled={!canTriage}
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
          <span className="mb-1.5 block text-xs text-slate-400">Priority</span>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as RequestPriority)}
            disabled={!canTriage}
            className={selectClass}
          >
            {(Object.keys(PRIORITY_LABELS) as RequestPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          {priority !== ticket.priority && (
            <span className="mt-1 block text-xs text-accent-400">
              SLA resets to {SLA_HOURS[priority]}h from now
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-slate-400">System</span>
          <select
            value={systemId}
            onChange={(e) => setSystemId(e.target.value)}
            disabled={!canTriage}
            className={selectClass}
          >
            <option value="">— unassigned —</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-slate-400">Owner</span>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            disabled={!canTriage}
            className={selectClass}
          >
            <option value="">— unassigned —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-slate-400">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={!canTriage}
            className={selectClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        {canTriage ? (
          <>
            <Button onClick={apply} disabled={saving || !dirty}>
              {saving ? "Applying…" : ticket.triagedAt ? "Update triage" : "Complete triage"}
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 size={13} /> Saved
              </span>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500">
            Your role can view this request but not set its priority or SLA.
          </p>
        )}
      </div>
    </Card>
  );
}
