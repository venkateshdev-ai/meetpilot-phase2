// RevOps request policy — the rules that turn an incoming request into a
// triaged, time-bound commitment.
//
// This lives in one file on purpose. Priority ladders and SLA clocks are the
// thing stakeholders argue about, so they need to be readable in a single
// screen and changeable without touching UI or route code.

export type RequestType =
  | "RUN_THE_BUSINESS"
  | "CHANGE_REQUEST"
  | "INCIDENT"
  | "ACCESS"
  | "DATA_FIX";

export type RequestPriority = "P0" | "P1" | "P2" | "P3";
export type RequestSource = "MEETING" | "DIRECT" | "MONITOR";
export type SystemCategory =
  | "CRM"
  | "CPQ"
  | "BILLING"
  | "SUPPORT"
  | "PARTNER"
  | "ANALYTICS"
  | "ENGAGEMENT"
  | "OTHER";

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  RUN_THE_BUSINESS: "Run the business",
  CHANGE_REQUEST: "Change request",
  INCIDENT: "Incident",
  ACCESS: "Access",
  DATA_FIX: "Data fix",
};

export const SOURCE_LABELS: Record<RequestSource, string> = {
  MEETING: "From meeting",
  DIRECT: "Filed directly",
  MONITOR: "Raised by monitor",
};

export const SYSTEM_CATEGORY_LABELS: Record<SystemCategory, string> = {
  CRM: "CRM",
  CPQ: "Quoting / CPQ",
  BILLING: "Billing",
  SUPPORT: "Support desk",
  PARTNER: "Partner portal",
  ANALYTICS: "Analytics / forecasting",
  ENGAGEMENT: "Sales engagement",
  OTHER: "Other",
};

// The SLA ladder. Hours-to-respond by priority — the single source of truth
// for every due-date calculation in the app.
export const SLA_HOURS: Record<RequestPriority, number> = {
  P0: 4, // business stopped — same working day
  P1: 24, // major impact with a workaround
  P2: 72, // normal change request
  P3: 240, // backlog / nice to have
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  P0: "P0 · Business stopped",
  P1: "P1 · Major impact",
  P2: "P2 · Normal",
  P3: "P3 · Low",
};

export const PRIORITY_TONE: Record<RequestPriority, "danger" | "warning" | "accent" | "neutral"> = {
  P0: "danger",
  P1: "warning",
  P2: "accent",
  P3: "neutral",
};

/** When this request is due, given when it was raised. */
export function slaDueAt(priority: RequestPriority, from: Date = new Date()): string {
  return new Date(from.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000).toISOString();
}

export interface SlaState {
  /** Negative once the deadline has passed. */
  hoursRemaining: number;
  breached: boolean;
  /** Inside the final 25% of the window — worth surfacing before it breaches. */
  atRisk: boolean;
  label: string;
}

/**
 * SLA state for a request. Resolved requests stop the clock: a request closed
 * before its deadline must never later render as "breached" just because time
 * kept passing.
 */
export function slaState(
  dueAt: string | null,
  priority: RequestPriority,
  resolvedAt: string | null = null,
  now: Date = new Date()
): SlaState | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  const reference = resolvedAt ? new Date(resolvedAt).getTime() : now.getTime();
  const hoursRemaining = (due - reference) / (1000 * 60 * 60);
  const breached = hoursRemaining < 0;
  const atRisk = !breached && hoursRemaining <= SLA_HOURS[priority] * 0.25;

  const abs = Math.abs(hoursRemaining);
  const magnitude = abs >= 48 ? `${Math.round(abs / 24)}d` : abs >= 1 ? `${Math.round(abs)}h` : `${Math.round(abs * 60)}m`;

  let label: string;
  if (resolvedAt) label = breached ? `Resolved ${magnitude} late` : `Resolved with ${magnitude} to spare`;
  else if (breached) label = `Overdue by ${magnitude}`;
  else label = `${magnitude} left`;

  return { hoursRemaining, breached, atRisk, label };
}

/**
 * Queue ordering a triage owner actually wants: anything breached floats up,
 * then by priority, then by how soon it's due. Resolved requests sink.
 */
export function triageSort<
  T extends { status: string; priority: RequestPriority; slaDueAt: string | null; resolvedAt: string | null }
>(requests: T[], now: Date = new Date()): T[] {
  const rank: Record<RequestPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  return [...requests].sort((a, b) => {
    const aDone = a.status === "DONE";
    const bDone = b.status === "DONE";
    if (aDone !== bDone) return aDone ? 1 : -1;

    const aSla = slaState(a.slaDueAt, a.priority, a.resolvedAt, now);
    const bSla = slaState(b.slaDueAt, b.priority, b.resolvedAt, now);
    const aBreached = !aDone && !!aSla?.breached;
    const bBreached = !bDone && !!bSla?.breached;
    if (aBreached !== bBreached) return aBreached ? -1 : 1;

    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];

    const aDue = a.slaDueAt ? new Date(a.slaDueAt).getTime() : Infinity;
    const bDue = b.slaDueAt ? new Date(b.slaDueAt).getTime() : Infinity;
    return aDue - bDue;
  });
}

/**
 * Suggested priority for an AI-extracted request, from the words people
 * actually use in meetings. Deliberately a *suggestion*: it pre-fills the
 * triage form, and a human confirms it at the review gate. Nothing here
 * silently sets an SLA commitment on its own.
 */
export function suggestPriority(text: string, type: RequestType): RequestPriority {
  const t = text.toLowerCase();
  if (type === "INCIDENT") return "P0";
  if (/\b(outage|down|broken|blocked|cannot|can't|urgent|asap|critical|escalat)/.test(t)) return "P1";
  if (/\b(nice to have|someday|eventually|backlog|low priority|when we get a chance)\b/.test(t)) return "P3";
  return "P2";
}

/** Suggested request type from meeting language — same "suggestion" contract. */
export function suggestRequestType(text: string): RequestType {
  const t = text.toLowerCase();
  if (/\b(outage|is down|not working|failing|broken in prod)\b/.test(t)) return "INCIDENT";
  if (/\b(access|permission|licen[cs]e|provision|seat|onboard the .*team)\b/.test(t)) return "ACCESS";
  // A bare mention of "data" is far too loose — "security review for the data
  // export path" is not a data fix. Require an actual corrective action.
  if (/\b(dedup\w*|duplicate|backfill|data (quality|fix|clean)|clean ?up|migrat\w+|re-?sync)\b/.test(t))
    return "DATA_FIX";
  if (/\b(fix|bug|error|wrong|incorrect|mismatch|broken)\b/.test(t)) return "RUN_THE_BUSINESS";
  return "CHANGE_REQUEST";
}
