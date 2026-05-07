"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const { bookings, openModal } = useApp();
  const b = bookings.find((x) => x.id === id);

  useEffect(() => {
    if (id && !b) {
      // booking not found — go back
      router.replace("/bookings");
    }
  }, [b, id, router]);

  if (!b) return null;

  const canConfirm = b.status === "Draft";
  const canLost = b.status === "Draft" || b.status === "Confirmed";
  const canPay = b.status === "Confirmed" && b.balance > 0;
  const canComplete = b.status === "Confirmed";

  const totalCollected =
    b.payments.reduce((s, p) => s + p.amount, 0) + b.extras.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>{b.guest}</h2>
          <p>
            {b.id} · {b.checkin} → {b.checkout} · {b.nights} night{b.nights !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/bookings" className="btn btn-ghost btn-sm">← All Bookings</Link>
      </div>

      <div>
        <div className="status-bar">
          <span><StatusBadge status={b.status} /></span>
          {b.allocatedRoom && (
            <span className="badge" style={{ background: "var(--blu-bg)", color: "var(--blu)" }}>
              🏡 Room {b.allocatedRoom}
            </span>
          )}
          {b.status === "Lost" && b.lostReason && (
            <span style={{ fontSize: 12, color: "var(--red)" }}>Reason: {b.lostReason}</span>
          )}
          <div className="status-actions">
            {canConfirm && (
              <button
                className="btn btn-accent btn-sm"
                onClick={() => openModal({ kind: "payment", bookingId: b.id })}
              >
                ✓ Confirm + Record Payment
              </button>
            )}
            {canPay && (
              <button
                className="btn btn-success btn-sm"
                onClick={() => openModal({ kind: "payment", bookingId: b.id })}
              >
                ₹ Record Payment
              </button>
            )}
            {canComplete && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => openModal({ kind: "complete", bookingId: b.id })}
              >
                Checkout &amp; Complete
              </button>
            )}
            {canLost && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => openModal({ kind: "lost", bookingId: b.id })}
              >
                ✕ Mark Lost
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => openModal({ kind: "quote", quote: { kind: "saved", bookingId: b.id } })}
            >
              📄 Quote
            </button>
          </div>
        </div>

        <div className="detail-layout">
          <div>
            <div className="detail-panel">
              <div className="detail-panel-hd"><h3>Guest &amp; Booking</h3></div>
              <div className="detail-panel-body">
                <div className="detail-row"><span className="detail-key">Guest Name</span><span className="detail-val">{b.guest}</span></div>
                <div className="detail-row"><span className="detail-key">Mobile</span><span className="detail-val">{b.mobile}</span></div>
                {b.email && (
                  <div className="detail-row"><span className="detail-key">Email</span><span className="detail-val">{b.email}</span></div>
                )}
                <div className="detail-row"><span className="detail-key">Source</span><span className="detail-val">{b.source || "—"}</span></div>
                <div className="detail-row"><span className="detail-key">Check-in</span><span className="detail-val">{b.checkin}</span></div>
                <div className="detail-row"><span className="detail-key">Check-out</span><span className="detail-val">{b.checkout}</span></div>
                <div className="detail-row"><span className="detail-key">Nights</span><span className="detail-val">{b.nights}</span></div>
                <div className="detail-row"><span className="detail-key">Guests</span><span className="detail-val">{b.adults} Adults{b.kids > 0 ? `, ${b.kids} Kids` : ""}</span></div>
                <div className="detail-row"><span className="detail-key">Rooms</span><span className="detail-val">{b.rooms.map((r) => r.name + (r.qty > 1 ? " ×" + r.qty : "")).join(", ")}</span></div>
                <div className="detail-row"><span className="detail-key">Meal Package</span><span className="detail-val">{b.mealOn ? "Included" : "Not included"}</span></div>
                <div className="detail-row"><span className="detail-key">Notes</span><span className="detail-val" style={{ color: "var(--t2)" }}>{b.notes || "—"}</span></div>
                <div className="detail-row"><span className="detail-key">Booking by</span><span className="detail-val">{b.rex}</span></div>
              </div>
            </div>

            <div className="detail-panel">
              <div className="detail-panel-hd"><h3>Price Breakdown</h3></div>
              <div className="detail-panel-body">
                <div className="detail-row"><span className="detail-key">Room Charges</span><span className="detail-val">{fmt(b.roomTotal)}</span></div>
                {b.discAmt > 0 && (
                  <div className="detail-row"><span className="detail-key">Discount ({b.discPct}%)</span><span className="detail-val" style={{ color: "var(--amb)" }}>− {fmt(b.discAmt)}</span></div>
                )}
                <div className="detail-row"><span className="detail-key">Net Room Charges</span><span className="detail-val">{fmt(b.netRoom)}</span></div>
                {b.mealTotal > 0 && (
                  <div className="detail-row"><span className="detail-key">Meal Package</span><span className="detail-val">{fmt(b.mealTotal)}</span></div>
                )}
                <div className="detail-row"><span className="detail-key">GST</span><span className="detail-val">{fmt(b.gstRoom + (b.mealGst || 0))}</span></div>
                {b.extras.length > 0 && (
                  <div className="detail-row"><span className="detail-key">Extras</span><span className="detail-val">{fmt(b.extras.reduce((s, e) => s + e.amount, 0))}</span></div>
                )}
                <div className="detail-row" style={{ background: "var(--surf2)" }}>
                  <span className="detail-key" style={{ fontWeight: 700, color: "var(--t1)" }}>Total Payable</span>
                  <span className="detail-val" style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 16, fontWeight: 800 }}>{fmt(b.total)}</span>
                </div>
                <div className="detail-row"><span className="detail-key">Advance Paid</span><span className="detail-val" style={{ color: "var(--grn)" }}>{fmt(b.advance)}</span></div>
                <div
                  className="detail-row"
                  style={{ background: b.balance > 0 ? "var(--amb-lt)" : "var(--grn-lt)" }}
                >
                  <span className="detail-key" style={{ fontWeight: 600 }}>{b.balance > 0 ? "Balance Due" : "Fully Paid"}</span>
                  <span className="detail-val" style={{ fontWeight: 700, color: b.balance > 0 ? "var(--amb)" : "var(--grn)" }}>
                    {b.balance > 0 ? fmt(b.balance) : "₹0 ✓"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="trail">
              <div className="trail-hd">
                <div className="trail-hd-title">Audit Trail</div>
                <div className="trail-hd-id">{b.id}</div>
              </div>
              {b.payments.map((p, i) => (
                <div key={i} className="trail-item">
                  <div className="t-dot t-grn"></div>
                  <div className="t-time">{p.date}</div>
                  <div className="t-lbl"><strong>{p.type}</strong> — {p.mode}</div>
                  {p.amount > 0 && <div className="t-amt">{fmt(p.amount)}</div>}
                  <div className="t-by">{p.by}</div>
                </div>
              ))}
              {b.extras.map((e, i) => (
                <div key={`e-${i}`} className="trail-item">
                  <div className="t-dot t-amb"></div>
                  <div className="t-time">{b.checkout}</div>
                  <div className="t-lbl"><strong>Extra: {e.name}</strong></div>
                  <div className="t-amt">{fmt(e.amount)}</div>
                  <div className="t-by">{b.rex}</div>
                </div>
              ))}
              {b.allocatedRoom && (
                <div className="trail-item">
                  <div className="t-dot t-blu"></div>
                  <div className="t-time">—</div>
                  <div className="t-lbl"><strong>Room Allocated</strong> — {b.allocatedRoom}</div>
                  <div className="t-by">Rahul</div>
                </div>
              )}
              {b.status === "Lost" && (
                <div className="trail-item">
                  <div className="t-dot t-red"></div>
                  <div className="t-time">—</div>
                  <div className="t-lbl"><strong>Marked Lost</strong>{b.lostReason ? ` — ${b.lostReason}` : ""}</div>
                  <div className="t-by">{b.rex}</div>
                </div>
              )}
              <div className="trail-total">
                <div className="trail-total-lbl">Total Collected</div>
                <div className="trail-total-val">{fmt(totalCollected)}</div>
              </div>
              <div className="trail-total" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
                <div className="trail-total-lbl">Total Booking Value</div>
                <div className="trail-total-val">{fmt(b.total)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
