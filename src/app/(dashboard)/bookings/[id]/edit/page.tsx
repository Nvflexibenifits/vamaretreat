"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { BookingForm } from "@/components/BookingForm";

export default function EditBookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { bookings, hydrated, showNotif } = useApp();
  const id = params?.id;
  const b = bookings.find((x) => x.id === id);

  useEffect(() => {
    if (!hydrated) return;
    if (!b) {
      router.replace("/bookings");
      return;
    }
    if (b.status === "Lost" || b.status === "Cancelled") {
      showNotif(`${b.status} bookings can't be edited`, "error");
      router.replace(`/bookings/${b.id}`);
    }
  }, [hydrated, b, router, showNotif]);

  if (!hydrated) {
    return (
      <div className="view">
        <p style={{ color: "var(--t3)" }}>Loading…</p>
      </div>
    );
  }

  if (!b) return null;
  if (b.status === "Lost" || b.status === "Cancelled") return null;

  return <BookingForm mode="edit" initial={b} />;
}
