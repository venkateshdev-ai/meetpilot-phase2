"use client";

import { useState } from "react";
import { Star, Users as UsersIcon, Ruler, MapPin } from "lucide-react";
import { Card, Badge, Button, Modal } from "@/components/ui";
import { listRooms } from "@/lib/mock/store";

// Adapted from the WeWork/MiQube reference wireframe (PDF), but rewired per
// the PRD gap analysis: rooms are attached to a MeetPilot meeting/agenda
// context instead of being a standalone, unbranded reservation.
export default function RoomsPage() {
  const rooms = listRooms();
  const [booking, setBooking] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Meeting rooms</h1>
      <p className="mb-6 text-sm text-slate-400">Book a physical room the same way you'd book a video call.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <Card key={r.id}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold">{r.name}</span>
              <span className="flex items-center gap-1 text-xs text-warning">
                <Star size={12} fill="currentColor" /> {r.rating}
              </span>
            </div>
            <div className="mb-2 flex gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><UsersIcon size={13} /> {r.capacity} seats</span>
              <span className="flex items-center gap-1"><Ruler size={13} /> {r.areaSqft} sqft</span>
            </div>
            <div className="mb-3 flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} /> {r.floor} · {r.zone}
            </div>
            <div className="mb-3 flex flex-wrap gap-1">
              {r.amenities.map((a) => (
                <span key={a} className="rounded-full bg-base-700 px-2 py-0.5 text-[10px] text-slate-300">{a}</span>
              ))}
            </div>
            {r.reviews[0] && (
              <p className="mb-3 text-xs italic text-slate-500">
                "{r.reviews[0].text}" — {r.reviews[0].author}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">₹{r.tariffPerHour}/hr</span>
              <Button onClick={() => setBooking(r.id)}>Book Now</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!booking} onClose={() => setBooking(null)} title="Confirm room booking">
        <p className="mb-4 text-sm text-slate-300">
          Booking {rooms.find((r) => r.id === booking)?.name} for today, 3:00 PM – 4:00 PM. This will create a
          MeetPilot meeting record so participants, agenda, and MoM are tracked automatically.
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

      <Modal open={!!confirmed} onClose={() => setConfirmed(null)} title="Booking confirmed">
        <div className="text-center">
          <Badge tone="success">MRB-{Math.floor(Math.random() * 900000 + 100000)}</Badge>
          <p className="mt-3 text-sm text-slate-300">
            Your room is booked. A QR code + OTP for room check-in has been sent to your MeetPilot notifications.
          </p>
        </div>
      </Modal>
    </div>
  );
}
