"use client";

import { useState } from "react";
import { MapPin, Monitor } from "lucide-react";
import { Card, Badge, Button, Modal } from "@/components/ui";
import { listDesks, listDeskBookingsForDate } from "@/lib/mock/store";

// Hot-desking: distinct from /rooms (which books a meeting room for a timeslot).
// A desk is booked per-day by a single person — this is the PRD gap-analysis
// item "desk booking, not just meeting rooms," closing the hybrid-work gap.
export default function DesksPage() {
  const desks = listDesks();
  const today = "2026-07-04";
  const bookings = listDeskBookingsForDate(today);
  const bookedByDesk = Object.fromEntries(bookings.map((b) => [b.deskId, b]));

  const [booking, setBooking] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const floors = Array.from(new Set(desks.map((d) => d.floor)));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Desks</h1>
      <p className="mb-6 text-sm text-slate-400">
        Book a desk for today — for hybrid teams that need a seat, not a meeting room.
      </p>

      {floors.map((floor) => (
        <div key={floor} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{floor}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {desks.filter((d) => d.floor === floor).map((d) => {
              const existing = bookedByDesk[d.id];
              const isTaken = !!existing && existing.status !== "CANCELLED";
              return (
                <Card key={d.id} className={!d.isActive ? "opacity-50" : ""}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold">{d.label}</span>
                    {!d.isActive ? (
                      <Badge tone="danger">Out of service</Badge>
                    ) : isTaken ? (
                      <Badge tone={existing.status === "CHECKED_IN" ? "success" : "warning"}>
                        {existing.status.replace("_", " ")}
                      </Badge>
                    ) : (
                      <Badge tone="accent">Available</Badge>
                    )}
                  </div>
                  <div className="mb-3 flex items-center gap-1 text-xs text-slate-400">
                    <MapPin size={13} /> {d.zone}
                  </div>
                  <div className="mb-4 flex flex-wrap gap-1">
                    {d.amenities.map((a) => (
                      <span key={a} className="flex items-center gap-1 rounded-full bg-base-700 px-2 py-0.5 text-[10px] text-slate-300">
                        <Monitor size={10} /> {a}
                      </span>
                    ))}
                  </div>
                  <Button
                    className="w-full justify-center"
                    disabled={!d.isActive || isTaken}
                    onClick={() => setBooking(d.id)}
                  >
                    {isTaken ? "Already booked" : "Book for today"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Modal open={!!booking} onClose={() => setBooking(null)} title="Confirm desk booking">
        <p className="mb-4 text-sm text-slate-300">
          Booking {desks.find((d) => d.id === booking)?.label} for today. You'll get a wayfinding note
          in your notifications so you can find it on arrival.
        </p>
        <Button
          className="w-full justify-center"
          onClick={() => {
            setConfirmed(booking);
            setBooking(null);
          }}
        >
          Confirm booking
        </Button>
      </Modal>

      <Modal open={!!confirmed} onClose={() => setConfirmed(null)} title="Desk booked">
        <div className="text-center">
          <Badge tone="success">Confirmed</Badge>
          <p className="mt-3 text-sm text-slate-300">
            {desks.find((d) => d.id === confirmed)?.label} is yours for today — {desks.find((d) => d.id === confirmed)?.zone}.
          </p>
        </div>
      </Modal>
    </div>
  );
}
