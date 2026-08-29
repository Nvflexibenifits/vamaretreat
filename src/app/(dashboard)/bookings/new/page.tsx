"use client";

import { BookingForm } from "@/components/BookingForm";
import { useApp } from "@/lib/store";

export default function NewBookingPage() {
  const { currentRole } = useApp();
  if (currentRole === "Front Office" || currentRole === "Finance") {
    return (
      <div className="view">
        <div className="pg-hd">
          <div>
            <h2>Access Denied</h2>
            <p>Creating bookings is not available for your role.</p>
          </div>
        </div>
      </div>
    );
  }
  return <BookingForm mode="create" />;
}
