"use client";

// Header search. Replaces a <span> that only looked like an input.
// Debounced, keyboard-navigable (↑/↓/Enter/Esc), and reachable with ⌘K.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, CalendarDays, Inbox, User, Server } from "lucide-react";
import clsx from "clsx";

interface SearchHit {
  type: "meeting" | "request" | "person" | "system";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const ICON = { meeting: CalendarDays, request: Inbox, person: User, system: Server };
const TYPE_LABEL = { meeting: "Meeting", request: "Request", person: "Person", system: "System" };

export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K focuses search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close when clicking away.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          setHits((await res.json()).hits ?? []);
          setActive(0);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const go = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      setQ("");
      router.push(hit.href);
    },
    [router]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active]);
    }
  }

  return (
    <div ref={boxRef} className="relative w-64">
      <div className="flex items-center gap-2 rounded-xl border border-base-700 bg-base-900 px-3 py-2 text-sm transition-colors focus-within:border-accent-500">
        {loading ? (
          <Loader2 size={15} className="shrink-0 animate-spin text-slate-500" />
        ) : (
          <Search size={15} className="shrink-0 text-slate-500" />
        )}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search meetings, requests…"
          className="w-full bg-transparent text-slate-200 placeholder:text-slate-600 focus:outline-none"
        />
        <kbd className="shrink-0 rounded border border-base-700 px-1.5 text-[10px] text-slate-600">⌘K</kbd>
      </div>

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-base-700 bg-base-800 py-1 shadow-2xl shadow-black/40">
          {hits.length === 0 && !loading ? (
            <p className="px-3.5 py-3 text-xs text-slate-500">No matches for “{q}”.</p>
          ) : (
            hits.map((hit, i) => {
              const Icon = ICON[hit.type];
              return (
                <button
                  key={`${hit.type}-${hit.id}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(hit)}
                  className={clsx(
                    "flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors",
                    i === active ? "bg-base-700" : "hover:bg-base-700/60"
                  )}
                >
                  <Icon size={14} className="shrink-0 text-accent-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-100">{hit.title}</span>
                    <span className="block truncate text-xs text-slate-500">{hit.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-600">
                    {TYPE_LABEL[hit.type]}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
