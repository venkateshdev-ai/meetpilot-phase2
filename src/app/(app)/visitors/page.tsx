"use client";

import { useState } from "react";
import { UserPlus, QrCode } from "lucide-react";
import { Card, Badge, Button, Modal, TextField, Avatar } from "@/components/ui";
import { listVisitors, getUser } from "@/lib/mock/store";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  INVITED: "neutral",
  CHECKED_IN: "success",
  CHECKED_OUT: "accent",
  CANCELLED: "danger",
};

// Front-desk / visitor management — the PRD gap item for external guests
// coming to a booked room: badges, host notification, check-in status.
export default function VisitorsPage() {
  const [visitors, setVisitors] = useState(listVisitors());
  const [inviting, setInviting] = useState(false);

  function checkIn(id: string) {
    setVisitors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: "CHECKED_IN", checkedInAt: new Date().toISOString() } : v))
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Visitors</h1>
        <Button onClick={() => setInviting(true)}>
          <span className="flex items-center gap-1.5"><UserPlus size={15} /> Invite visitor</span>
        </Button>
      </div>
      <p className="mb-6 text-sm text-slate-400">Front-desk check-in for guests coming to a booked room.</p>

      <Card className="divide-y divide-base-700 p-0">
        {visitors.map((v) => {
          const host = getUser(v.hostUserId);
          return (
            <div key={v.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="text-sm font-medium">{v.name}</div>
                <div className="text-xs text-slate-500">{v.purpose}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  {host && (
                    <span className="flex items-center gap-1">
                      <Avatar name={host.name} color={host.avatarColor} size={16} /> Hosted by {host.name}
                    </span>
                  )}
                  <span>· Expected {new Date(v.expectedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {v.badgeCode && (
                  <span className="flex items-center gap-1 rounded-full bg-base-700 px-2.5 py-1 text-[10px] text-slate-300">
                    <QrCode size={11} /> {v.badgeCode}
                  </span>
                )}
                <Badge tone={STATUS_TONE[v.status]}>{v.status.replace("_", " ")}</Badge>
                {v.status === "INVITED" && (
                  <Button variant="secondary" onClick={() => checkIn(v.id)}>
                    Check in
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite a visitor">
        <TextField label="Full name" placeholder="Priya Sharma" />
        <TextField label="Email" placeholder="priya@clientco.com" />
        <TextField label="Purpose of visit" placeholder="Product demo" />
        <Button className="w-full justify-center" onClick={() => setInviting(false)}>
          Send invite
        </Button>
      </Modal>
    </div>
  );
}
