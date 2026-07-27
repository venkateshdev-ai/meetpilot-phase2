// Thin server-only REST client for the real Supabase Postgres database.
//
// Why this exists instead of @prisma/client at runtime: `prisma/schema.prisma`
// is still the source of truth for the data model (kept in sync with the SQL
// migration applied to the real DB), but this sandbox's network allowlist
// blocks downloading Prisma's native query-engine binary from
// binaries.prisma.sh (403 Forbidden), which @prisma/client needs to run a
// single query, not just to `generate`. Rather than fall back to mock data,
// every MeetPilot-core page in this build talks to the same real, hosted
// Postgres database (Supabase) directly over its REST layer (PostgREST),
// which needs no native binary — just fetch().
//
// Going to a normal deployment target (Vercel, Fly.io, your own server): none
// of this needs to change to work, but the more idiomatic move is to swap
// these functions for the equivalent `prisma.*` calls (the 1:1 mapping is
// still commented in src/lib/db/store.ts) since a normal environment can
// download the Prisma engine fine.
//
// SECURITY POSTURE: RLS is ENABLED on every table with NO policies for
// anon/authenticated (default-deny). This file therefore uses the
// service_role key — which bypasses RLS — so the app keeps full access,
// while the anon key (or anyone hitting the Data API directly) can no
// longer read or write anything. Both keys are server-side only (never
// NEXT_PUBLIC_-prefixed, never sent to the browser). Org-scoping remains
// enforced in this data-access layer (every query filters by orgId).
// The anon-key fallback below only matters for a fresh env missing the
// service key — with RLS on, anon gets empty results, which fails safe.

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Fail loudly at import time in dev rather than silently returning empty data.
  console.warn(
    "[db] SUPABASE_URL / SUPABASE_ANON_KEY are not set — real data calls will fail. See .env.example."
  );
}

const REST_BASE = `${SUPABASE_URL}/rest/v1`;

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function handle(res: Response) {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase REST ${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

/** GET a table with PostgREST filter/order/select query params, e.g. { orderQuery: "startTime.desc" } */
export async function pgSelect<T = any>(
  table: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const qs = new URLSearchParams({ select: "*", ...params });
  const res = await fetch(`${REST_BASE}/${table}?${qs.toString()}`, {
    headers: headers(),
    cache: "no-store",
  });
  return handle(res);
}

export async function pgInsert<T = any>(table: string, rows: object | object[]): Promise<T[]> {
  const res = await fetch(`${REST_BASE}/${table}`, {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  return handle(res);
}

export async function pgUpdate<T = any>(
  table: string,
  match: Record<string, string>,
  patch: object
): Promise<T[]> {
  const qs = new URLSearchParams(match);
  const res = await fetch(`${REST_BASE}/${table}?${qs.toString()}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  return handle(res);
}

export function genId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export async function pgDelete(table: string, match: Record<string, string>): Promise<void> {
  const qs = new URLSearchParams(match);
  const res = await fetch(`${REST_BASE}/${table}?${qs.toString()}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase REST ${res.status}: ${body}`);
  }
}
