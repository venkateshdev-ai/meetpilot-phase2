import { NextResponse } from "next/server";
import {
  listGtmSystems,
  listTicketsForOrg,
  createTicket,
  updateGtmSystem,
  listUsers,
  recordAudit,
} from "@/lib/db/store";
import { slaState } from "@/lib/revops";

// System health sweep.
//
// The JD-shaped requirement this satisfies: "set up monitoring capabilities to
// proactively identify data errors, inaccuracies and pipeline failures, and
// recommend automation where necessary." Until now `RequestSource.MONITOR`
// existed as an enum value with nothing that produced it — the monitor-raised
// requests in the demo data were staged by hand.
//
// Run it on a schedule (Vercel Cron, GitHub Actions, or any pinger):
//   POST /api/monitor   with header  x-monitor-key: $MONITOR_SECRET
//
// Auth is a shared secret rather than a session, because the caller is a cron
// job, not a person. Fails closed when the secret is unset.

interface Finding {
  systemId: string | null;
  systemName: string;
  title: string;
  description: string;
  priority: "P0" | "P1" | "P2";
  degradeSystem: boolean;
}

export async function POST(req: Request) {
  const secret = process.env.MONITOR_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "MONITOR_SECRET is not configured — refusing to run unauthenticated." },
      { status: 503 }
    );
  }
  if (req.headers.get("x-monitor-key") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [systems, tickets, users] = await Promise.all([
    listGtmSystems(),
    listTicketsForOrg(),
    listUsers(),
  ]);
  const openTickets = tickets.filter((t) => t.status !== "DONE");
  const findings: Finding[] = [];

  // --- Check 1: systems with no accountable owner -------------------------
  // An unowned system means an incoming request has nobody to route to.
  for (const s of systems.filter((s) => s.isActive && !s.ownerId)) {
    findings.push({
      systemId: s.id,
      systemName: s.name,
      title: `Assign an owner for ${s.name}`,
      description: `${s.name} has no owner, so requests against it cannot be routed to an accountable person.`,
      priority: "P2",
      degradeSystem: false,
    });
  }

  // --- Check 2: SLA breaches concentrated on one system -------------------
  // A single late request is a scheduling problem; several on the same system
  // is a signal about the system itself, so it is escalated and the system is
  // marked degraded.
  const breachedBySystem = new Map<string, number>();
  for (const t of openTickets) {
    if (t.systemId && slaState(t.slaDueAt, t.priority, t.resolvedAt)?.breached) {
      breachedBySystem.set(t.systemId, (breachedBySystem.get(t.systemId) ?? 0) + 1);
    }
  }
  for (const [systemId, count] of breachedBySystem) {
    if (count < 2) continue;
    const s = systems.find((x) => x.id === systemId);
    if (!s) continue;
    findings.push({
      systemId,
      systemName: s.name,
      title: `${count} requests past SLA on ${s.name}`,
      description: `${count} open requests against ${s.name} have breached their SLA. This usually indicates a capacity or ownership problem rather than isolated slippage.`,
      priority: "P1",
      degradeSystem: true,
    });
  }

  // --- Check 3: untriaged backlog ageing ----------------------------------
  const DAY = 24 * 60 * 60 * 1000;
  const staleUntriaged = openTickets.filter(
    (t) => !t.triagedAt && Date.now() - new Date(t.createdAt).getTime() > 2 * DAY
  );
  if (staleUntriaged.length > 0) {
    findings.push({
      systemId: null,
      systemName: "Request intake",
      title: `${staleUntriaged.length} request(s) untriaged for over 2 days`,
      description: `Requests are arriving faster than they are being triaged. Oldest: "${staleUntriaged[0].title}".`,
      priority: "P2",
      degradeSystem: false,
    });
  }

  // --- Raise findings as requests -----------------------------------------
  // Idempotent by title: a monitor that re-files the same finding every run
  // would bury the queue it is meant to protect.
  const existingTitles = new Set(openTickets.map((t) => t.title.trim().toLowerCase()));
  const systemOwner = (id: string | null) => systems.find((s) => s.id === id)?.ownerId ?? null;
  const fallbackOwner = users[0]?.id;

  const created = [];
  for (const f of findings) {
    if (existingTitles.has(f.title.toLowerCase())) continue;
    const createdById = systemOwner(f.systemId) ?? fallbackOwner;
    if (!createdById) continue;

    created.push(
      await createTicket({
        title: f.title,
        description: f.description,
        whyScenario: "Raised automatically by the MeetPilot system health monitor.",
        requestType: "RUN_THE_BUSINESS",
        priority: f.priority,
        source: "MONITOR",
        systemId: f.systemId,
        assigneeId: systemOwner(f.systemId),
        createdById,
      })
    );
    existingTitles.add(f.title.toLowerCase());

    if (f.degradeSystem && f.systemId) {
      const s = systems.find((x) => x.id === f.systemId);
      if (s && s.status === "HEALTHY") {
        await updateGtmSystem(f.systemId, { status: "DEGRADED" });
        await recordAudit({
          action: "system.status_changed",
          targetType: "GtmSystem",
          targetId: f.systemId,
          metadata: { name: s.name, before: "HEALTHY", after: "DEGRADED", reason: f.title },
        });
      }
    }
  }

  return NextResponse.json({
    checkedSystems: systems.length,
    checkedRequests: openTickets.length,
    findings: findings.length,
    raised: created.length,
    requests: created.map((c) => ({ id: c.id, title: c.title, priority: c.priority })),
  });
}
