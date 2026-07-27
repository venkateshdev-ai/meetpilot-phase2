import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMeetings, listTicketsForOrg, listUsers, listGtmSystems } from "@/lib/db/store";

export interface SearchHit {
  type: "meeting" | "request" | "person" | "system";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

// Cross-object search for the header box, which until now was a <span> styled
// to look like an input — it wasn't clickable or typeable.
//
// Matching happens in-process over the org's rows rather than in SQL. At this
// data volume that is both fast and simpler than maintaining a tsvector index;
// if the row count grows, this is the seam to swap for Postgres full-text
// search without changing the client.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const [meetings, tickets, users, systems] = await Promise.all([
    listMeetings(),
    listTicketsForOrg(),
    listUsers(),
    listGtmSystems(),
  ]);

  const hits: SearchHit[] = [];
  const match = (...fields: (string | null | undefined)[]) =>
    fields.some((f) => f?.toLowerCase().includes(q));

  for (const m of meetings) {
    if (match(m.title, m.agenda)) {
      hits.push({
        type: "meeting",
        id: m.id,
        title: m.title,
        subtitle: new Date(m.startTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        href: `/meetings/${m.id}`,
      });
    }
  }

  const systemsById = Object.fromEntries(systems.map((s) => [s.id, s]));
  for (const t of tickets) {
    if (match(t.title, t.description, t.acceptanceCriteria)) {
      hits.push({
        type: "request",
        id: t.id,
        title: t.title,
        subtitle: `${t.priority} · ${t.systemId ? systemsById[t.systemId]?.name ?? "—" : "no system"}`,
        href: `/tickets/${t.id}`,
      });
    }
  }

  for (const u of users) {
    if (match(u.name, u.email)) {
      hits.push({
        type: "person",
        id: u.id,
        title: u.name ?? u.email,
        subtitle: u.email,
        href: "/users",
      });
    }
  }

  for (const s of systems) {
    if (match(s.name, s.description)) {
      hits.push({ type: "system", id: s.id, title: s.name, subtitle: s.category, href: "/systems" });
    }
  }

  return NextResponse.json({ hits: hits.slice(0, 20) });
}
