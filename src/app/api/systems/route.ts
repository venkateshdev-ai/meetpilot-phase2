import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  findUserByEmail,
  listGtmSystems,
  createGtmSystem,
  listMembershipsByRole,
  recordAudit,
} from "@/lib/db/store";
import { can, Role } from "@/lib/rbac";
import { SYSTEM_CATEGORY_LABELS } from "@/lib/revops";

// The registry of revenue systems MeetPilot governs requests for. Owning this
// model (rather than reading it out of one CRM vendor) is what lets a request
// be filed against "Quoting / CPQ" regardless of which product implements it.

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json(await listGtmSystems());
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const roleByUser = await listMembershipsByRole();
  const role = roleByUser[me.id] as Role | undefined;
  if (!role || !can(role, "system:manage")) {
    return NextResponse.json({ error: "Only an Admin can register systems." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const category = body?.category ?? "OTHER";
  if (!(category in SYSTEM_CATEGORY_LABELS)) {
    return NextResponse.json({ error: `Unknown category "${category}"` }, { status: 422 });
  }

  try {
    const system = await createGtmSystem({
      name,
      category,
      description: body?.description,
      ownerId: body?.ownerId ?? null,
    });
    await recordAudit({
      actorId: me.id,
      action: "system.registered",
      targetType: "GtmSystem",
      targetId: system.id,
      metadata: { name: system.name, category: system.category },
    });
    return NextResponse.json(system, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The (orgId, name) unique constraint surfaces as a 23505 from PostgREST.
    if (message.includes("23505") || message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: `A system named "${name}" already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
