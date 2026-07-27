"use client";

// The GTM systems registry: what MeetPilot governs requests *for*.
//
// This is the deliberate alternative to integrating a specific CRM. A system
// here is a name, a category, an accountable owner, and a health status —
// enough to route and prioritise a request without caring whether the thing
// behind it is Salesforce, HubSpot, or an internal service.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CircleDot, Plus } from "lucide-react";
import clsx from "clsx";
import { Card, Badge, Button } from "@/components/ui";
import type { DbGtmSystem, DbUser, DbTicket } from "@/lib/db/store";
import { SYSTEM_CATEGORY_LABELS, slaState, type SystemCategory } from "@/lib/revops";

const STATUS_META: Record<
  DbGtmSystem["status"],
  { tone: "success" | "warning" | "danger"; icon: typeof CheckCircle2; label: string }
> = {
  HEALTHY: { tone: "success", icon: CheckCircle2, label: "Healthy" },
  DEGRADED: { tone: "warning", icon: CircleDot, label: "Degraded" },
  DOWN: { tone: "danger", icon: AlertTriangle, label: "Down" },
};

export default function SystemsPanel({
  systems,
  tickets,
  usersById,
  canManage,
}: {
  systems: DbGtmSystem[];
  tickets: DbTicket[];
  usersById: Record<string, DbUser>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SystemCategory>("CRM");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addSystem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, description }),
      });
      if (res.ok) {
        setName("");
        setDescription("");
        setAdding(false);
        router.refresh();
      } else {
        setError((await res.json().catch(() => ({}))).error ?? `Failed (HTTP ${res.status})`);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          {adding ? (
            <form onSubmit={addSystem} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-400">System name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Quoting engine"
                    className="w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-500 focus:outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-400">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SystemCategory)}
                    className="w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2 text-sm text-white focus:border-accent-500 focus:outline-none"
                  >
                    {Object.entries(SYSTEM_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs text-slate-400">What it does</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One line — what breaks for the business when this breaks"
                  className="w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2 text-sm text-white placeholder:text-slate-600 focus:border-accent-500 focus:outline-none"
                />
              </label>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Registering…" : "Register system"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex w-full items-center justify-center gap-2 text-sm text-slate-400 transition hover:text-accent-400"
            >
              <Plus size={15} /> Register a system
            </button>
          )}
        </Card>
      )}

      {systems.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-400">
          No systems registered yet. Add the tools your GTM teams depend on — requests get filed against
          them.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {systems.map((s) => {
            const meta = STATUS_META[s.status];
            const Icon = meta.icon;
            const owner = s.ownerId ? usersById[s.ownerId] : undefined;
            const open = tickets.filter((t) => t.systemId === s.id && t.status !== "DONE");
            const breached = open.filter(
              (t) => slaState(t.slaDueAt, t.priority, t.resolvedAt)?.breached
            ).length;
            return (
              <Card key={s.id} className={clsx(s.status !== "HEALTHY" && "border-warning/30")}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-100">{s.name}</h3>
                    <p className="text-xs text-slate-500">{SYSTEM_CATEGORY_LABELS[s.category]}</p>
                  </div>
                  <Badge tone={meta.tone}>
                    <span className="flex items-center gap-1">
                      <Icon size={11} /> {meta.label}
                    </span>
                  </Badge>
                </div>
                {s.description && <p className="mb-3 text-xs text-slate-400">{s.description}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-base-700 pt-2.5 text-xs text-slate-500">
                  <span>Owner: {owner ? owner.name : "unassigned"}</span>
                  <span>·</span>
                  <span>{open.length} open</span>
                  {breached > 0 && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-danger">{breached} breached</span>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
