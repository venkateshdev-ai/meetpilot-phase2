import { Card } from "@/components/ui";
import { listAuditLog, listUsers } from "@/lib/db/store";

// The real audit log. An earlier build shipped a hardcoded sentence here that
// described events which never happened; this reads the append-only AuditLog
// table that createTicket/triageTicket/system routes now write to.

const ACTION_LABELS: Record<string, string> = {
  "request.created": "created request",
  "request.triaged": "triaged request",
  "request.retriaged": "re-triaged request",
  "system.registered": "registered system",
};

function describe(action: string, metadata: Record<string, unknown> | null): string {
  const label = ACTION_LABELS[action] ?? action;
  const title = (metadata?.title ?? metadata?.name ?? "") as string;
  return title ? `${label} “${title}”` : label;
}

export default async function AuditLogPanel() {
  const [entries, users] = await Promise.all([listAuditLog(25), listUsers()]);
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  if (entries.length === 0) {
    return (
      <Card className="text-sm text-slate-400">
        No activity recorded yet. Triaging a request or registering a system writes an entry here.
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-base-700 p-0">
      {entries.map((e) => {
        const actor = e.actorId ? usersById[e.actorId] : undefined;
        const before = (e.metadata?.before ?? null) as Record<string, unknown> | null;
        const after = (e.metadata?.after ?? null) as Record<string, unknown> | null;
        const changed =
          before && after
            ? Object.keys(after).filter((k) => before[k] !== undefined && before[k] !== after[k])
            : [];
        return (
          <div key={e.id} className="px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-medium text-slate-200">{actor?.name ?? "System"}</span>
              <span className="text-slate-400">{describe(e.action, e.metadata)}</span>
            </div>
            {changed.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {changed.map((k) => (
                  <span key={k}>
                    {k}: <span className="text-slate-400">{String(before![k])}</span> →{" "}
                    <span className="text-accent-400">{String(after![k])}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-1 text-xs text-slate-600">
              {new Date(e.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
