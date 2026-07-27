import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, listMembershipsByRole } from "@/lib/db/store";
import { ROLE_LABELS, Role } from "@/lib/rbac";
import ChatSidebar from "@/components/ChatSidebar";
import AppShell from "@/components/AppShell";

function colorFor(id: string) {
  const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const email = session?.user?.email;
  const [dbUser, roleByUser] = await Promise.all([
    email ? findUserByEmail(email) : Promise.resolve(undefined),
    listMembershipsByRole(),
  ]);
  const role = (dbUser ? roleByUser[dbUser.id] : undefined) as Role | undefined;
  const id = dbUser?.id ?? "guest";
  const user = {
    name: dbUser?.name ?? session?.user?.name ?? "Guest",
    id,
    roleLabel: role ? ROLE_LABELS[role] ?? role : "Reviewer",
    // Resolved here so the client shell doesn't need the colour helper.
    color: colorFor(id),
  };

  return (
    <AppShell user={user}>
      {children}
      <ChatSidebar currentUserName={user.name} />
    </AppShell>
  );
}
