"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";

export function LostModal() {
  const { modal, closeModal, markLost, showNotif, bookings } = useApp();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  if (modal.kind !== "lost" || !modal.bookingId) return null;
  const b = bookings.find((x) => x.id === modal.bookingId);

  const onConfirm = () => {
    if (!reason) {
      showNotif("Please select a reason", "error");
      return;
    }
    markLost(modal.bookingId!, reason, notes);
    closeModal();
    setReason("");
    setNotes("");
    if (b) showNotif(`${b.guest} — Marked as Lost`, "success");
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal modal-sm">
        <h3 style={{ color: "var(--red)" }}>Mark as Lost</h3>
        <p className="modal-desc">
          Select the reason this enquiry didn&apos;t convert. This data helps identify patterns.
        </p>
        <div className="field">
          <label>Reason *</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">— Select reason —</option>
            <option>Price too high</option>
            <option>Dates not available</option>
            <option>No response from guest</option>
            <option>Chose a competitor</option>
            <option>Guest cancelled plans</option>
            <option>Other</option>
          </select>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context..."
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Mark as Lost</button>
        </div>
      </div>
    </div>
  );
}
