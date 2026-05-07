"use client";

import { useApp } from "@/lib/store";
import { fmt } from "@/lib/utils";
import type { Booking } from "@/types";

export function QuoteModal() {
  const { modal, closeModal, bookings } = useApp();

  if (modal.kind !== "quote" || !modal.quote) return null;

  const q = modal.quote;
  const b: Booking | undefined =
    q.kind === "saved" ? bookings.find((x) => x.id === q.bookingId) : q.booking;

  if (!b) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="modal modal-lg">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3>Quote Preview</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              🖨 Print / Save PDF
            </button>
            <button className="btn btn-ghost btn-sm" onClick={closeModal}>
              ✕ Close
            </button>
          </div>
        </div>
        <div className="quote-wrap">
          <div className="quote-logo-row">
            <div className="quote-mark">VR</div>
            <div style={{ flex: 1 }}>
              <div className="quote-brand">Vama Retreats</div>
              <div style={{ fontSize: 11, color: "var(--t3)" }}>
                Stay Quote · {new Date().toLocaleDateString("en-IN")}
              </div>
            </div>
            <div className="quote-id">{b.id}</div>
          </div>
          <div className="quote-guest-name">{b.guest}</div>
          <div className="quote-stay">
            {b.checkin} → {b.checkout} · {b.nights} night{b.nights !== 1 ? "s" : ""} · {b.adults} Adults
            {b.kids > 0 ? `, ${b.kids} Kids` : ""}
          </div>
          {b.rooms.map((r, i) => (
            <div key={i} className="quote-line">
              <span>
                {r.name}
                {r.qty > 1 ? ` ×${r.qty}` : ""}
              </span>
              <span>
                <strong>{fmt(b!.roomTotal)}</strong>
              </span>
            </div>
          ))}
          {b.discAmt > 0 && (
            <div className="quote-line">
              <span>Discount ({b.discPct}%)</span>
              <span style={{ color: "var(--amb)" }}>− {fmt(b.discAmt)}</span>
            </div>
          )}
          {b.mealTotal > 0 && (
            <div className="quote-line">
              <span>Meal &amp; Activity Package</span>
              <span>{fmt(b.mealTotal)}</span>
            </div>
          )}
          <div className="quote-line">
            <span>GST</span>
            <span>{fmt(b.gstRoom + (b.mealGst || 0))}</span>
          </div>
          <hr style={{ border: "none", borderTop: "2px solid var(--sb)", margin: "12px 0" }} />
          <div className="quote-total-row">
            <div className="quote-total-lbl">Total Payable</div>
            <div className="quote-total-val">{fmt(b.total)}</div>
          </div>
          {b.advance > 0 && (
            <div className="quote-line">
              <span>Advance Paid</span>
              <span style={{ color: "var(--grn)" }}>{fmt(b.advance)}</span>
            </div>
          )}
          {b.balance > 0 && (
            <div
              className="quote-line"
              style={{
                background: "var(--amb-lt)",
                padding: "8px 12px",
                borderRadius: 4,
                marginTop: 4,
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--amb)" }}>Balance at Check-in</span>
              <span style={{ fontWeight: 700, color: "var(--amb)" }}>{fmt(b.balance)}</span>
            </div>
          )}
          <div className="quote-footer">
            Vama Retreats · All prices inclusive of GST · Valid for 48 hours
            <br />
            Contact: +91 XXXXX XXXXX · vamaretreats.com
          </div>
        </div>
      </div>
    </div>
  );
}
