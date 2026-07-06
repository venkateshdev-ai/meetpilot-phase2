import { NextResponse } from "next/server";
import { pushActionItem } from "@/lib/db/store";

// Writes a real ActionItem row update (status + synced ticket fields). The
// ticket ID itself is generated locally, not from a live Jira/Asana/Linear
// call — see the doc-comment on pushActionItem in src/lib/db/store.ts for why
// that's still out of scope for this pass.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const provider = body?.provider as "JIRA" | "ASANA" | "LINEAR" | undefined;
  if (!provider || !["JIRA", "ASANA", "LINEAR"].includes(provider)) {
    return NextResponse.json({ error: "provider must be JIRA, ASANA, or LINEAR" }, { status: 400 });
  }

  const updated = await pushActionItem(params.id, provider);
  return NextResponse.json(updated);
}
