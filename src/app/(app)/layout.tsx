import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Avatar } from "@/components/ui";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, listMembershipsByRole } from "@/lib/db/store";
import { ROLE_LABELS, Role } from "@/lib/rbac";
import ChatSidebar from "@/components/ChatSidebar";
import NavLinks from "@/components/NavLinks";
import GlobalSearch from "@/components/GlobalSearch";

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
  const user = {
    name: dbUser?.name ?? session?.user?.name ?? "Guest",
    id: dbUser?.id ?? "guest",
    roleLabel: role ? ROLE_LABELS[role] ?? role : "Reviewer",
  };
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-base-700/70 bg-base-950/60 p-4 backdrop-blur">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow">
            <span className="h-3 w-3 rounded-sm bg-white/90" />
          </span>
          <span className="text-[15px] font-bold tracking-tight">MeetPilot</span>
        </Link>
        <NavLinks />
        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-base-700 hover:bg-base-800/60"
        >
          <Avatar name={user.name} color={colorFor(user.id)} size={30} />
          <div className="min-w-0 text-xs">
            <div className="truncate font-medium text-slate-100">{user.name}</div>
            <div className="truncate text-slate-500">{user.roleLabel}</div>
          </div>
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-base-700/70 bg-base-900/80 px-6 py-3.5 backdrop-blur">
          <GlobalSearch />
          <Link href="/profile" className="rounded-full ring-2 ring-transparent transition hover:ring-accent-500/40">
            <Avatar name={user.name} color={colorFor(user.id)} size={32} />
          </Link>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
      <ChatSidebar currentUserName={user.name} />
    </div>
  );
}
