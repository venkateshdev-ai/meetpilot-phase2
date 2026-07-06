"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send } from "lucide-react";
import { Avatar } from "@/components/ui";

function colorFor(id: string) {
  const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

// Slack-style team chat: a collapsible right-side panel available on every
// page. Messages are real ChatMessage rows; the panel polls every 5s while
// open (a production build would swap polling for Supabase Realtime/SSE).
export default function ChatSidebar({ currentUserName }: { currentUserName: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  async function refresh() {
    const res = await fetch("/api/chat").catch(() => null);
    if (res?.ok) setMessages(await res.json());
  }

  useEffect(() => {
    if (!open) return;
    refresh();
    const interval = setInterval(() => {
      if (openRef.current) refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    if (res?.ok) await refresh();
    else setDraft(text);
    setSending(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Team chat"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lg transition hover:scale-105"
      >
        <MessageSquare size={20} />
      </button>
    );
  }

  return (
    <aside className="sticky top-0 flex h-screen w-80 shrink-0 flex-col border-l border-base-700 bg-base-800/60">
      <div className="flex items-center justify-between border-b border-base-700 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-accent-400" />
          <span className="text-sm font-semibold">Team chat</span>
          <span className="text-xs text-slate-500">#general</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="pt-6 text-center text-xs text-slate-500">
            No messages yet — say hi to the team.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <Avatar name={m.userName} color={colorFor(m.userId)} size={26} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-slate-200">{m.userName}</span>
                <span className="text-[10px] text-slate-500">
                  {new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <p className="break-words text-sm text-slate-300">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-base-700 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message as ${currentUserName}…`}
          className="min-w-0 flex-1 rounded-xl border border-base-700 bg-base-900 px-3 py-2 text-sm text-white outline-none focus:border-accent-500"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </form>
    </aside>
  );
}
