import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Card, Badge, Button } from "@/components/ui";
import { listTicketsForOrg } from "@/lib/db/store";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  OPEN: "neutral",
  IN_PROGRESS: "warning",
  DONE: "success",
  BLOCKED: "danger",
};

// Full CRUD ticket list — MeetPilot's own Ticket table (source of truth for
// the rich fields), separate from whatever's live in a connected PM tool.
// See /admin > Integrations for connecting Jira/Asana/Trello/Slack, and each
// ticket's detail page for the "push to tool" + "view tickets already in
// that tool" actions.
export default async function TicketsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const tickets = await listTicketsForOrg();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">Tickets</h1>
          <p className="text-sm text-slate-400">Full specs, ready to push to Jira, Asana, Trello, or Slack.</p>
        </div>
        <Link href="/tickets/new">
          <Button>+ New ticket</Button>
        </Link>
      </div>

      <Card className="divide-y divide-base-700 p-0">
        {tickets.length === 0 && <div className="p-5 text-sm text-slate-400">No tickets yet.</div>}
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/tickets/${t.id}`}
            className="flex items-center justify-between gap-3 p-4 hover:bg-base-700/40"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{t.title}</div>
              <div className="mt-1 text-xs text-slate-500">
                {t.provider ? `Pushed to ${t.provider} · ${t.externalId}` : "Not pushed to any tool yet"}
              </div>
            </div>
            <Badge tone={STATUS_TONE[t.status]}>{t.status.replace("_", " ")}</Badge>
          </Link>
        ))}
      </Card>
    </div>
  );
}
