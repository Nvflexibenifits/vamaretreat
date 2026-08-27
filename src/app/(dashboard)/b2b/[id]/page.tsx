"use client";

import Link from "next/link";
import { use } from "react";
import { B2BBookingForm } from "@/components/B2BBookingForm";
import { useApp } from "@/lib/store";

export default function EditB2BBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { b2bBookings, hydrated } = useApp();
  const booking = b2bBookings.find((b) => b.id === id);

  if (!hydrated) {
    return (
      <div className="view">
        <div className="pg-hd"><div><h2>Loading…</h2></div></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="view">
        <div className="pg-hd">
          <div>
            <h2>Booking not found</h2>
            <p>No B2B booking with ID {id}</p>
          </div>
        </div>
        <Link href="/b2b" className="btn btn-primary btn-sm">Back to B2B Bookings</Link>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>{booking.orgName}</h2>
          <p>
            {booking.id} · {booking.type} · {booking.status}
          </p>
        </div>
      </div>
      <B2BBookingForm mode="edit" initial={booking} />
    </div>
  );
}
