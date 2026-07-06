import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Home, Calendar, Users, BarChart3, Settings, DoorOpen, Search, Armchair, UserCheck, Receipt, Ticket } from "lucide-react";
import { Avatar } from "@/components/ui";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, listMembershipsByRole } from "@/lib/db/store";

function colorFor(id: string) {
  const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/desks", label: "Desks", icon: Armchair },
  { href: "/visitors", label: "Visitors", icon: UserCheck },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/admin", label: "Admin", icon: Users },
  { href: "/admin#settings", label: "Settings", icon: Settings },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const email = session?.user?.email;
  const [dbUser, roleByUser] = await Promise.all([
    email ? findUserByEmail(email) : Promise.resolve(undefined),
    listMembershipsByRole(),
  ]);
  const user = {
    name: dbUser?.name ?? session?.user?.name ?? "Guest",
    id: dbUser?.id ?? "guest",
    role: dbUser ? roleByUser[dbUser.id] ?? "MEMBER" : "GUEST",
  };
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-base-700 bg-base-800/40 p-4">
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2">
          <span className="h-7 w-7 rounded-lg bg-brand-gradient" />
          <span className="font-bold">MeetPilot</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-base-700 hover:text-white"
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-base-700"
        >
          <Avatar name={user.name} color={colorFor(user.id)} size={28} />
          <div className="text-xs">
            <div className="font-medium text-slate-100">{user.name}</div>
            <div className="text-slate-500">{user.role.replace("_", " ")}</div>
          </div>
        </Link>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-base-700 px-6 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-base-700 bg-base-900 px-3 py-2 text-sm text-slate-400">
            <Search size={16} />
            <span>Search team...</span>
          </div>
          <Link href="/profile">
            <Avatar name={user.name} color={colorFor(user.id)} size={32} />
          </Link>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
