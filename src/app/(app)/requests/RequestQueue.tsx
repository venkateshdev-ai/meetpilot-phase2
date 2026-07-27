"use client";

// The triage queue — the working surface for a RevOps product owner.
//
// Ordering is deliberate and lives in src/lib/revops.ts: breached SLAs first,
// then priority, then soonest due. The point is that the top of this list is
// always the thing that should be worked next, with no sorting decisions left
// to the person reading it.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Clock, Filter, Inbox, Zap } from "lucide-react";
import clsx from "clsx";
import { Card, Badge, Button } from "@/components/ui";
import type { DbTicket, DbGtmSystem, DbUser } from "@/lib/db/store";
import {
  PRIORITY_LABELS,
  PRIORITY_TONE,
  REQUEST_TYPE_LABELS,
  SOURCE_LABELS,
  slaState,
  triageSort,
  type RequestPriority,
} from "@/lib/revops";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  OPEN: "neutral",
  IN_PROGRESS: "warning",
  DONE: "success",
  BLOCKED: "danger",
};

export default function RequestQueue({
  tickets,
  systems,
  usersById,
  canTriage,
}: {
  tickets: DbTicket[];
  systems: DbGtmSystem[];
  usersById: Record<string, DbUser>;
  canTriage: boolean;
}) {
  const router = useRouter();
  const [showResolved, setShowResolved] = useState(false);
  const [systemFilter, setSystemFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const systemsById = useMemo(
    () => Object.fromEntries(systems.map((s) => [s.id, s])),
    [systems]
  );

  const visible = useMemo(() => {
    const filtered = tickets.filter((t) => {
      if (!showResolved && t.status === "DONE") return false;
      if (systemFilter !== "ALL" && t.systemId !== systemFilter) return false;
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      return true;
    });
    return triageSort(filtered);
  }, [tickets, showResolved, systemFilter, priorityFilter]);

  const breachedCount = useMemo(
    () =>
      tickets.filter(
        (t) => t.status !== "DONE" && slaState(t.slaDueAt, t.priority, t.resolvedAt)?.breached
      ).length,
    [tickets]
  );
  const untriagedCount = useMemo(() => tickets.filter((t) => !t.triagedAt).length, [tickets]);

  // Inline escalation straight from the queue — the most common triage action
  // is "this is more urgent than it looks", and making that a page-visit would
  // put friction on the one thing a queue owner does dozens of times a day.
  async function setPriority(id: string, priority: RequestPriority) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/tickets/${id}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Queue health strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-accent-400">{tickets.filter((t) => t.status !== "DONE").length}</div>
          <div className="text-xs text-slate-500">Open requests</div>
        </Card>
        <Card className={clsx("p-4", breachedCount > 0 && "border-danger/40")}>
          <div className={clsx("text-2xl font-bold", breachedCount > 0 ? "text-danger" : "text-accent-400")}>
            {breachedCount}
          </div>
          <div className="text-xs text-slate-500">SLA breached</div>
        </Card>
        <Card className={clsx("p-4", untriagedCount > 0 && "border-warning/40")}>
          <div className={clsx("text-2xl font-bold", untriagedCount > 0 ? "text-warning" : "text-accent-400")}>
            {untriagedCount}
          </div>
          <div className="text-xs text-slate-500">Awaiting triage</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-accent-400">{systems.length}</div>
          <div className="text-xs text-slate-500">Systems covered</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter size={13} /> Filter
        </span>
        <select
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
          className="rounded-xl border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-slate-200 focus:border-accent-500 focus:outline-none"
        >
          <option value="ALL">All systems</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-xl border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-slate-200 focus:border-accent-500 focus:outline-none"
        >
          <option value="ALL">All priorities</option>
          {(["P0", "P1", "P2", "P3"] as RequestPriority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowResolved((v) => !v)}
          className={clsx(
            "rounded-xl border px-3 py-1.5 text-xs transition",
            showResolved
              ? "border-accent-500/40 bg-accent-500/10 text-accent-400"
              : "border-base-700 text-slate-400 hover:text-slate-200"
          )}
        >
          {showResolved ? "Showing resolved" : "Hiding resolved"}
        </button>
      </div>

      {/* Queue */}
      {visible.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Inbox size={22} className="text-slate-600" />
          <p className="text-sm text-slate-400">Nothing in the queue matches these filters.</p>
        </Card>
      ) : (
        <Card className="divide-y divide-base-700 p-0">
          {visible.map((t) => {
            const sla = slaState(t.slaDueAt, t.priority, t.resolvedAt);
            const system = t.systemId ? systemsById[t.systemId] : undefined;
            const assignee = t.assigneeId ? usersById[t.assigneeId] : undefined;
            const isDone = t.status === "DONE";
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority}</Badge>
                    <Link
                      href={`/tickets/${t.id}`}
                      className="truncate text-sm font-medium text-slate-100 hover:text-accent-400"
                    >
                      {t.title}
                    </Link>
                    {!t.triagedAt && <Badge tone="warning">Needs triage</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                    <span>{REQUEST_TYPE_LABELS[t.requestType]}</span>
                    <span>·</span>
                    <span>{system ? system.name : "Unassigned system"}</span>
                    <span>·</span>
                    <span>{SOURCE_LABELS[t.source]}</span>
                    {assignee && (
                      <>
                        <span>·</span>
                        <span>{assignee.name}</span>
                      </>
                    )}
                  </div>
                </div>

                {sla && (
                  <span
                    className={clsx(
                      "flex shrink-0 items-center gap-1.5 text-xs font-medium",
                      isDone
                        ? "text-slate-500"
                        : sla.breached
                          ? "text-danger"
                          : sla.atRisk
                            ? "text-warning"
                            : "text-slate-400"
                    )}
                    title={t.slaDueAt ? `Due ${new Date(t.slaDueAt).toLocaleString()}` : undefined}
                  >
                    {!isDone && sla.breached ? <AlertTriangle size={13} /> : <Clock size={13} />}
                    {sla.label}
                  </span>
                )}

                <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>

                {canTriage && !isDone && t.priority !== "P0" && (
                  <Button
                    variant="ghost"
                    className="shrink-0 !px-2 !py-1 text-xs"
                    disabled={busyId === t.id}
                    onClick={() => setPriority(t.id, "P0")}
                    title="Escalate to P0"
                  >
                    <span className="flex items-center gap-1">
                      <Zap size={12} /> Escalate
                    </span>
                  </Button>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
