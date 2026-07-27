"use client";

// The application shell: sidebar + header, responsive.
//
// The previous shell hard-coded a 224px sidebar with no small-screen handling
// at all. Below roughly 1024px that sidebar ate most of the viewport and the
// content column collapsed until text wrapped one character per line. On a
// phone the app was unusable.
//
// Now the sidebar is a permanent rail on large screens and an off-canvas
// drawer below that, opened from a hamburger in the header.

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import clsx from "clsx";
import { Avatar } from "@/components/ui";
import NavLinks from "@/components/NavLinks";
import GlobalSearch from "@/components/GlobalSearch";

export default function AppShell({
  user,
  children,
}: {
  user: { name: string; id: string; roleLabel: string; color: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating should dismiss the drawer, otherwise it covers the page you
  // just asked for.
  useEffect(() => setOpen(false), [pathname]);

  // Escape closes it, and while it's open the body must not scroll behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const sidebar = (
    <>
      <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gradient shadow-glow">
          <span className="h-3 w-3 rounded-sm bg-white/90" />
        </span>
        <span className="text-[15px] font-bold tracking-tight">MeetPilot</span>
      </Link>
      <NavLinks />
      <Link
        href="/profile"
        className="flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-base-700 hover:bg-base-800/60"
      >
        <Avatar name={user.name} color={user.color} size={30} />
        <div className="min-w-0 text-xs">
          <div className="truncate font-medium text-slate-100">{user.name}</div>
          <div className="truncate text-slate-500">{user.roleLabel}</div>
        </div>
      </Link>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Permanent rail — large screens only */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-base-700/70 bg-base-950/60 p-4 backdrop-blur lg:flex">
        {sidebar}
      </aside>

      {/* Off-canvas drawer — below lg */}
      <div
        className={clsx(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={clsx(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <aside
          className={clsx(
            "absolute left-0 top-0 flex h-full w-64 flex-col border-r border-base-700 bg-base-950 p-4 transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-base-800 hover:text-white"
          >
            <X size={18} />
          </button>
          {sidebar}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-base-700/70 bg-base-900/80 px-4 py-3.5 backdrop-blur sm:px-6">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-base-800 hover:text-white lg:hidden"
          >
            <Menu size={20} />
          </button>
          <GlobalSearch />
          <Link
            href="/profile"
            className="ml-auto shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-accent-500/40"
          >
            <Avatar name={user.name} color={user.color} size={32} />
          </Link>
        </header>
        {/* min-w-0 is what stops a wide child (a table, a chart) from forcing
            the whole page to scroll sideways. */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
