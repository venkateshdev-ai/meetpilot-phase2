import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateActionItemStatus } from "@/lib/db/store";

const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

// Status toggle from the MoM side panel (FRD: action items with a Done
// switch) — flips an action item between OPEN and DONE (or any valid status).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const updated = await updateActionItemStatus(params.id, status);
  if (!updated) return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  return NextResponse.json(updated);
}
