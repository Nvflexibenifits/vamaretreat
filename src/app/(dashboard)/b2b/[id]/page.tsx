"use client";

import Link from "next/link";
import { use } from "react";
import { B2BBookingForm } from "@/components/B2BBookingForm";
import { useApp } from "@/lib/store";
import { fmt, fmtIN, statusBadgeClass } from "@/lib/utils";
import type { B2BBooking } from "@/types";

export default function EditB2BBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { b2bBookings, hydrated, currentRole } = useApp();
  const booking = b2bBookings.find((b) => b.id === id);
  // Finance opens this from the Revenue Register's View link — it may look,
  // never edit, so it gets a read-only summary instead of the form.
  const readOnly = currentRole === "Front Office" || currentRole === "Finance";

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
        {!readOnly && (
          <Link href="/b2b" className="btn btn-primary btn-sm">Back to B2B Bookings</Link>
        )}
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
      {readOnly ? (
        <B2BReadOnly booking={booking} />
      ) : (
        <B2BBookingForm mode="edit" initial={booking} />
      )}
    </div>
  );
}

// ─── Read-only view ───
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-key">{label}</span>
      <span className="detail-val">{value || "—"}</span>
    </div>
  );
}

function B2BReadOnly({ booking: b }: { booking: B2BBooking }) {
  const orgLabel =
    b.type === "School" ? "School Name" : b.type === "Institute" ? "Institute Name" : "Company Name";
  const extrasNet = (b.extras ?? []).reduce((s, e) => s + e.amount, 0);
  const extrasGst = (b.extras ?? []).reduce((s, e) => s + (e.gst ?? 0), 0);

  return (
    <>
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">1</span>Booking Details
            <span className={`badge ${statusBadgeClass(b.status)}`} style={{ marginLeft: 10 }}>
              {b.status}
            </span>
          </div>
          <Row label="Type" value={b.type} />
          <Row label={orgLabel} value={b.orgName} />
          <Row label="Contact Person" value={b.contactPerson} />
          <Row label="Contact Number" value={b.contactNumber} />
          <Row label="Email ID" value={b.email} />
          <Row label="TAG Name" value={b.tagName} />
          <Row label="TAG Contact Name" value={b.tagContactName} />
          <Row label="TAG Contact Number" value={b.tagContactNumber} />
          <Row label="TAG Email ID" value={b.tagEmail} />
        </div>
      </div>

      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">2</span>Stay Details
          </div>
          <Row label="Booking Type" value={b.bookingType === "Dayout" ? "Day Out" : "Overnight"} />
          <Row
            label={b.bookingType === "Dayout" ? "Date" : "Check-in"}
            value={fmtIN(b.checkin)}
          />
          {b.bookingType === "Overnight" && <Row label="Check-out" value={fmtIN(b.checkout)} />}
          <Row label="Pax Count" value={String(b.pax || 0)} />
        </div>
      </div>

      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">3</span>Add-on Charges
          </div>
          {(b.extras ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--t3)" }}>No add-on charges</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Amount (₹)</th>
                    <th style={{ textAlign: "right" }}>GST Amt</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(b.extras ?? []).map((e, i) => (
                    <tr key={i} style={{ cursor: "default" }}>
                      <td>{e.name}</td>
                      <td style={{ textAlign: "right" }}>{fmt(e.amount)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(e.gst ?? 0)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {fmt(e.amount + (e.gst ?? 0))}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "var(--surf2)", fontWeight: 700, cursor: "default" }}>
                    <td>Total</td>
                    <td style={{ textAlign: "right" }}>{fmt(extrasNet)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(extrasGst)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(b.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">4</span>Payments
          </div>
          {(b.payments ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--t3)" }}>No payments recorded</div>
          ) : (
            <table className="pricing-tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th style={{ textAlign: "right" }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {b.payments.map((p, i) => (
                  <tr key={i} style={{ cursor: "default" }}>
                    <td>{fmtIN(p.date)}</td>
                    <td>{p.mode}</td>
                    <td style={{ textAlign: "right" }}>{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="detail-row" style={{ marginTop: 14 }}>
            <span className="detail-key" style={{ fontWeight: 600 }}>Amount Due</span>
            <span className="detail-val" style={{ fontWeight: 800, fontSize: 16 }}>
              {fmt(b.grandTotal)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-key" style={{ fontWeight: 600 }}>Total Received</span>
            <span className="detail-val" style={{ fontWeight: 800, fontSize: 16 }}>
              {fmt(b.advance)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-key" style={{ fontWeight: 600 }}>Balance</span>
            <span
              className="detail-val"
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: b.balance > 0 ? "var(--amb)" : "var(--grn)",
              }}
            >
              {fmt(b.balance)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
