import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, updateUserProfile } from "@/lib/db/store";

// Update your own profile. Email is intentionally NOT editable here: it is the
// NextAuth credentials identity, so changing it would need a verification step
// before it could be trusted as a login. The form reflects that by rendering
// email read-only.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 422 });
  if (name.length > 120) return NextResponse.json({ error: "Name is too long" }, { status: 422 });

  const updated = await updateUserProfile(me.id, { name });
  return NextResponse.json({ id: updated.id, name: updated.name, email: updated.email });
}
