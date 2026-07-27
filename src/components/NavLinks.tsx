"use client";

// Sidebar nav with active-route highlighting — client-side because the server
// layout can't know the current pathname.

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Home, Users, BarChart3, Settings, Inbox, Server } from "lucide-react";

// Defined here (client side) because icon components aren't serializable
// across the server→client boundary.
const NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/requests", label: "Requests", icon: Inbox },
  { href: "/systems", label: "Systems", icon: Server },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/admin", label: "Settings", icon: Settings },
];

export default function NavLinks() {
  const pathname = usePathname();
  const items = NAV;
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={clsx(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent-500/10 font-medium text-white ring-1 ring-inset ring-accent-500/25"
                : "text-slate-400 hover:bg-base-700/70 hover:text-white"
            )}
          >
            <item.icon
              size={17}
              className={clsx(
                "transition-colors",
                active ? "text-accent-400" : "text-slate-500 group-hover:text-slate-300"
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
