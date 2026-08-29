"use client";

import { B2BBookingForm } from "@/components/B2BBookingForm";
import { useApp } from "@/lib/store";

export default function NewB2BBookingPage() {
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
  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>New B2B Booking</h2>
          <p>Corporate, school or institute booking</p>
        </div>
      </div>
      <B2BBookingForm mode="create" />
    </div>
  );
}
