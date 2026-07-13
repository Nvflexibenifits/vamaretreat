"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/utils";

export function PaymentModal() {
  const { modal, closeModal, recordPayment, redeemCreditNote, creditNotes, showNotif, bookings } = useApp();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("UPI / QR");
  const [type, setType] = useState("Balance Payment");
  const [cnCode, setCnCode] = useState("");

  if (modal.kind !== "payment" || !modal.bookingId) return null;
  const b = bookings.find((x) => x.id === modal.bookingId);

  const matchedNote = cnCode.trim()
    ? creditNotes.find((c) => c.code.toLowerCase() === cnCode.trim().toLowerCase())
    : undefined;

  const onConfirm = () => {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) {
      showNotif("Enter a valid amount", "error");
      return;
    }
    if (mode === "Credit Note") {
      if (!cnCode.trim()) {
        showNotif("Enter the credit note code", "error");
        return;
      }
      const result = redeemCreditNote(cnCode, modal.bookingId!, amt);
      if (!result.ok) {
        showNotif(result.error, "error");
        return;
      }
      recordPayment(modal.bookingId!, amt, mode, type, result.note.code);
    } else {
      recordPayment(modal.bookingId!, amt, mode, type);
    }
    closeModal();
    setAmount("");
    setCnCode("");
    if (b) showNotif(`${fmt(amt)} recorded for ${b.guest}`, "success");
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal modal-sm">
        <h3>Record Payment</h3>
        <p className="modal-desc">
          {b ? `Balance due: ${fmt(b.balance)}` : "Record a payment for this booking."}
        </p>
        <div className="fg" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Amount (₹) *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              min={1}
            />
          </div>
          <div className="field">
            <label>Payment Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option>UPI / QR</option>
              <option>Cash</option>
              <option>Bank Transfer</option>
              <option>Credit Note</option>
            </select>
          </div>
        </div>
        {mode === "Credit Note" && (
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Credit Note Code *</label>
            <input
              type="text"
              value={cnCode}
              onChange={(e) => setCnCode(e.target.value)}
              placeholder="e.g. CN-2026-001"
              autoFocus
            />
            {cnCode.trim() && (
              <div
                className="field-hint"
                style={{ color: matchedNote ? (matchedNote.remainingAmount > 0 ? "var(--grn)" : "var(--red)") : "var(--red)" }}
              >
                {matchedNote
                  ? `${matchedNote.guestName} · ${fmt(matchedNote.remainingAmount)} available`
                  : "Code not found"}
              </div>
            )}
          </div>
        )}
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option>Balance Payment</option>
            <option>Partial Payment</option>
            <option>Extra: Meal</option>
            <option>Extra: Activity</option>
            <option>Extra: Other</option>
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-success" onClick={onConfirm}>Record Payment</button>
        </div>
      </div>
    </div>
  );
}
