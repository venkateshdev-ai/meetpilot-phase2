import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, listMembershipsByRole, listOrgIntegrations, upsertIntegration } from "@/lib/db/store";
import { can, Role } from "@/lib/rbac";

async function requireIntegrationManager() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const me = await findUserByEmail(session.user.email);
  const roleByUser = me ? await listMembershipsByRole() : {};
  const myRole = (me && roleByUser[me.id]) as Role | undefined;
  if (!myRole || !can(myRole, "integration:manage")) {
    return { error: NextResponse.json({ error: "Forbidden — only Org Admins/Team Leads can manage integrations" }, { status: 403 }) };
  }
  return { me };
}

// Never return accessTokenEnc to the client — this list is for the Admin UI
// to show "connected / not connected" + which config is set, not to expose
// the secret back out.
export async function GET() {
  const auth = await requireIntegrationManager();
  if (auth.error) return auth.error;

  const integrations = await listOrgIntegrations();
  return NextResponse.json(
    integrations.map((i) => ({
      provider: i.provider,
      connected: !!i.accessTokenEnc,
      config: i.config,
    }))
  );
}

export async function POST(req: Request) {
  const auth = await requireIntegrationManager();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const { provider, secret, config } = body ?? {};
  if (!provider || !secret) {
    return NextResponse.json({ error: "provider and secret are required" }, { status: 400 });
  }
  if (!["JIRA", "ASANA", "TRELLO", "SLACK"].includes(provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }

  await upsertIntegration({ provider, secret, config: config ?? {}, connectedById: auth.me!.id });
  return NextResponse.json({ ok: true });
}
