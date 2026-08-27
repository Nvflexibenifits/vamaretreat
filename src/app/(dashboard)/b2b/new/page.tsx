"use client";

import { B2BBookingForm } from "@/components/B2BBookingForm";

export default function NewB2BBookingPage() {
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
