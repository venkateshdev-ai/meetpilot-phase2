"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

// Google Meet / Zoom style "New meeting → Start an instant meeting": one
// click creates an IN_PROGRESS meeting starting now and drops you straight
// into its Call tab (live video room), no scheduling form.
export default function InstantMeetingButton() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instant: true }),
      });
      if (!res.ok) throw new Error("Failed to start meeting");
      const meeting = await res.json();
      router.push(`/meetings/${meeting.id}`);
    } catch {
      setStarting(false);
    }
  }

  return (
    <Button variant="secondary" onClick={handleStart} disabled={starting}>
      <span className="flex items-center gap-1.5">
        {starting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
        {starting ? "Starting…" : "Start instant meeting"}
      </span>
    </Button>
  );
}
