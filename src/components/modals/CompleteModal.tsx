"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { todayStr } from "@/lib/utils";
import type { Extra } from "@/types";

type ExtraRow = { id: number; name: string; amount: string };

export function CompleteModal() {
  const { modal, closeModal, completeBooking, showNotif, bookings, currentUser } = useApp();
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [extraNights, setExtraNights] = useState("0");
  const [counter, setCounter] = useState(0);

  if (modal.kind !== "complete" || !modal.bookingId) return null;
  const b = bookings.find((x) => x.id === modal.bookingId);

  const addRow = () => {
    setCounter((c) => c + 1);
    setRows((prev) => [...prev, { id: counter + 1, name: "", amount: "" }]);
  };

  const removeRow = (id: number) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const updateRow = (id: number, key: "name" | "amount", value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const onConfirm = () => {
    const extras: Extra[] = rows
      .map((r) => ({
        name: r.name.trim(),
        amount: parseInt(r.amount) || 0,
        date: todayStr(),
        by: currentUser,
      }))
      .filter((e) => e.name && e.amount > 0);
    const en = parseInt(extraNights) || 0;
    completeBooking(modal.bookingId!, extras, en);
    closeModal();
    setRows([]);
    setExtraNights("0");
    if (b) showNotif(`${b.guest} — Booking Completed`, "success");
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal">
        <h3 style={{ color: "var(--grn)" }}>Complete Booking — Checkout</h3>
        <p className="modal-desc">Finalise the booking. Add any extra charges before completing.</p>
        <div className="hbox hbox-amb" style={{ marginBottom: 16 }}>
          <div className="hbox-title">Extra Charges During Stay</div>
          <p className="hbox-p">Add any services consumed that aren&apos;t part of the original booking.</p>
        </div>
        <div>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{ display: "grid", gridTemplateColumns: "1fr 120px 32px", gap: 8, alignItems: "end", marginBottom: 8 }}
            >
              <div className="field">
                <label>Description</label>
                <input
                  type="text"
                  value={r.name}
                  onChange={(e) => updateRow(r.id, "name", e.target.value)}
                  placeholder="BBQ dinner, bonfire, etc."
                />
              </div>
              <div className="field">
                <label>Amount (₹)</label>
                <input
                  type="number"
                  value={r.amount}
                  onChange={(e) => updateRow(r.id, "amount", e.target.value)}
                  placeholder="0"
                  min={0}
                />
              </div>
              <button
                className="btn btn-ghost btn-xs"
                style={{ marginBottom: 1 }}
                onClick={() => removeRow(r.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginBottom: 16, width: "100%", justifyContent: "center" }}
          onClick={addRow}
        >
          Add Extra Charge
        </button>
        <div className="field">
          <label>Stay Extension (additional nights)</label>
          <input
            type="number"
            value={extraNights}
            onChange={(e) => setExtraNights(e.target.value)}
            min={0}
            placeholder="0"
          />
          <div className="field-hint">Extra nights at same tariff will be added</div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
          <button className="btn btn-success" onClick={onConfirm}>Mark as Completed</button>
        </div>
      </div>
    </div>
  );
}
