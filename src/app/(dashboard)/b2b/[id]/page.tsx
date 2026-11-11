"use client";

import Link from "next/link";
import { use, useState } from "react";
import { B2BBookingForm } from "@/components/B2BBookingForm";
import { useApp } from "@/lib/store";
import { b2bStatusNow, cashOfPayments, compareRoomLabels, fmt, fmtIN, isCreditNotePayment, isTdsPayment, nowTime, statusBadgeClass, tdsOfPayments, todayStr } from "@/lib/utils";
import { FIGURE_INPUT, PctAmtToggle, type CancelBy } from "@/components/PctAmtToggle";
import { REFUND_TYPE } from "@/types";
import type { B2BBooking } from "@/types";

export default function EditB2BBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const {
    b2bBookings, hydrated, currentRole, currentUser, updateB2BBooking, cancelB2BBooking, creditNoteSettings,
    bulkRoomBlocks, venueBlocks, removeBulkRoomBlock, removeVenueBlock, showNotif,
  } = useApp();
  const [today] = useState(() => todayStr());
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  // Cancellation of a confirmed booking: refund and credit note, each as a
  // share of what was paid or a rupee figure
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundIn, setRefundIn] = useState("0");
  const [refundBy, setRefundBy] = useState<CancelBy>("pct");
  const [cnIn, setCnIn] = useState("0");
  const [cnBy, setCnBy] = useState<CancelBy>("pct");
  // Money handed back after a refund cancellation
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutMode, setPayoutMode] = useState("Bank Transfer");
  const [payoutDate, setPayoutDate] = useState(() => todayStr());
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

  const statusNow = b2bStatusNow(booking, today);
  // Lost is explicit when staff give up on an enquiry; a lapsed one is read
  // as lost without any write. Either way the chart holds are released.
  const canMarkLost = !readOnly && (statusNow === "Enquiry" || statusNow === "Tentative");
  const statusNote =
    statusNow === "Lost"
      ? booking.status === "Lost"
        ? booking.lostReason ? ` · ${booking.lostReason}` : ""
        : " · check-in date passed"
      : "";
  const releaseHolds = () => {
    if (booking.roomBlockId && bulkRoomBlocks.some((x) => x.id === booking.roomBlockId)) {
      removeBulkRoomBlock(booking.roomBlockId);
    }
    (booking.venueBlockIds ?? []).forEach((vid) => {
      if (venueBlocks.some((v) => v.id === vid)) removeVenueBlock(vid);
    });
  };
  const markLost = () => {
    releaseHolds();
    updateB2BBooking(booking.id, {
      status: "Lost",
      lostReason: lostReason.trim(),
      roomBlockId: null,
      venueBlockIds: [],
    });
    setLostOpen(false);
    showNotif(`${booking.id} marked lost`, "success");
  };

  // Only a confirmed booking is cancelled; an enquiry or tentative one is lost
  const canCancel = !readOnly && statusNow === "Confirmed";
  // Bank and cash actually received, net of refunds. TDS and a redeemed
  // credit note settle the bill but never arrived as money, so nothing of
  // them comes back.
  const paid = (booking.payments ?? []).filter((p) => !isTdsPayment(p) && !isCreditNotePayment(p)).reduce((s, p) => s + p.amount, 0);
  const figure = (input: string, by: CancelBy) => {
    const n = Math.max(0, parseFloat(input) || 0);
    return by === "amt" ? Math.round(n) : Math.round((paid * Math.min(100, n)) / 100);
  };
  const refundAmt = figure(refundIn, refundBy);
  const cnAmt = figure(cnIn, cnBy);
  const over = refundAmt + cnAmt > paid;
  const retained = Math.max(0, paid - refundAmt - cnAmt);
  const pctOf = (amt: number) => (paid > 0 ? Math.round((amt / paid) * 10000) / 100 : 0);
  const switchRefundBy = (by: CancelBy) => {
    if (by !== refundBy) setRefundIn(String(by === "amt" ? refundAmt : pctOf(refundAmt)));
    setRefundBy(by);
  };
  const switchCnBy = (by: CancelBy) => {
    if (by !== cnBy) setCnIn(String(by === "amt" ? cnAmt : pctOf(cnAmt)));
    setCnBy(by);
  };
  const cnCode = cnAmt > 0 ? `${creditNoteSettings.prefix}-${String(creditNoteSettings.nextNumber).padStart(4, "0")}` : undefined;
  const openCancel = () => {
    setRefundIn("0");
    setRefundBy("pct");
    setCnIn("0");
    setCnBy("pct");
    setCancelOpen(true);
  };
  const confirmCancel = () => {
    if (over) {
      showNotif(`Refund and credit note together cannot exceed ${fmt(paid)}`, "error");
      return;
    }
    const daysBefore = Math.max(0, Math.round((new Date(booking.checkin + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000));
    releaseHolds();
    cancelB2BBooking(booking, {
      cancellationDate: today,
      daysBeforeCheckin: daysBefore,
      policyType: "standard",
      cancellationCharge: retained,
      refundAmount: refundAmt,
      creditNoteAmount: cnAmt,
      refundPct: pctOf(refundAmt),
      creditNotePct: pctOf(cnAmt),
      resolution: refundAmt > 0 ? "refund" : cnAmt > 0 ? "credit-note" : "refund",
      creditNoteCode: cnCode,
      processedBy: currentUser,
    });
    setCancelOpen(false);
    showNotif(`${booking.id} cancelled${cnCode ? ` · credit note ${cnCode} for ${fmt(cnAmt)}` : ""}`, "success");
  };

  // Refund still to hand back on a cancelled booking. Each payout is a
  // negative payment row, so the booking's own money figures stay net.
  const cd = booking.cancellationDetails;
  const refundPaid = (cd?.refundPayouts ?? []).reduce((s, p) => s + p.amount, 0);
  const refundDue = cd ? Math.max(0, cd.refundAmount - refundPaid) : 0;
  const recordPayout = () => {
    if (!cd || refundDue <= 0) return;
    const on = payoutDate || today;
    const payments = [...(booking.payments ?? []), { date: on, time: nowTime(), type: REFUND_TYPE, amount: -refundDue, mode: payoutMode, by: currentUser }];
    updateB2BBooking(booking.id, {
      payments,
      advance: cashOfPayments(payments),
      cancellationDetails: { ...cd, refundPayouts: [...(cd.refundPayouts ?? []), { date: on, amount: refundDue, mode: payoutMode, by: currentUser }] },
    });
    setPayoutOpen(false);
    showNotif(`Refund of ${fmt(refundDue)} recorded`, "success");
  };

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>{booking.orgName}</h2>
          <p>
            {booking.id} · {booking.type} · {statusNow}{statusNote}
          </p>
        </div>
        {(canMarkLost || canCancel) && (
          <div className="pg-hd-actions">
            {canCancel && (
              <button
                className="btn btn-danger btn-sm"
                onClick={openCancel}
                title="Cancel this confirmed booking. Rooms and venues held on the chart are released."
              >
                Cancel Booking
              </button>
            )}
            {canMarkLost && (lostOpen ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder="Reason (optional)"
                  style={{ height: 32, padding: "0 10px", fontSize: 13, border: "1px solid var(--bd)", borderRadius: "var(--r2)", background: "var(--surf)", width: 220 }}
                />
                <button className="btn btn-danger btn-sm" onClick={markLost}>Confirm Lost</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setLostOpen(false)}>Keep</button>
              </div>
            ) : (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setLostOpen(true)}
                title="Mark this enquiry as lost. Rooms and venues held on the chart are released."
              >
                Mark Lost
              </button>
            ))}
          </div>
        )}
      </div>

      {booking.status === "Cancelled" && cd && (
        <div className="form-panel">
          <div className="form-sec">
            <div className="form-sec-title">
              Cancellation
              <span className="badge bd-cancelled" style={{ marginLeft: 10 }}>Cancelled</span>
            </div>
            <Row label="Cancelled on" value={`${fmtIN(cd.cancellationDate)} · ${cd.processedBy}`} />
            <Row label="Paid by bank / cash" value={fmt(cd.cancellationCharge + cd.refundAmount + cd.creditNoteAmount)} />
            <Row label="Refund" value={cd.refundAmount > 0 ? `${fmt(cd.refundAmount)} (${cd.refundPct ?? 0}%)` : "None"} />
            <Row label="Credit note" value={cd.creditNoteAmount > 0 ? `${cd.creditNoteCode} · ${fmt(cd.creditNoteAmount)} (${cd.creditNotePct ?? 0}%)` : "None"} />
            <Row label="Retained as cancellation charge" value={fmt(cd.cancellationCharge)} />
            {cd.refundAmount > 0 && (
              <div className="detail-row">
                <span className="detail-key">Refund handed back</span>
                <span className="detail-val" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span>{fmt(refundPaid)} of {fmt(cd.refundAmount)}</span>
                  {!readOnly && refundDue > 0 && (payoutOpen ? (
                    <>
                      <select value={payoutMode} onChange={(e) => setPayoutMode(e.target.value)} style={{ height: 30 }}>
                        <option>Bank Transfer</option>
                        <option>Cash</option>
                        <option>Cheque</option>
                      </select>
                      <input type="date" value={payoutDate} max={today} onChange={(e) => setPayoutDate(e.target.value)} style={{ height: 30 }} />
                      <button className="btn btn-primary btn-xs" onClick={recordPayout}>Record {fmt(refundDue)}</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setPayoutOpen(false)}>Cancel</button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-xs" style={{ color: "var(--pur)" }} onClick={() => setPayoutOpen(true)}>
                      Record refund of {fmt(refundDue)}
                    </button>
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {readOnly || booking.status === "Cancelled" ? (
        <B2BReadOnly booking={booking} />
      ) : (
        <B2BBookingForm mode="edit" initial={booking} />
      )}

      {cancelOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelOpen(false);
          }}
        >
          <div className="modal" style={{ width: 520, maxWidth: "calc(100vw - 32px)" }}>
            <h3 style={{ color: "var(--red)" }}>Cancel Booking</h3>
            <p className="modal-desc">
              {booking.orgName} · {booking.id} · {fmtIN(booking.checkin)}
              {booking.bookingType === "Overnight" ? ` to ${fmtIN(booking.checkout)}` : " · Day Out"}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surf2)", borderRadius: "var(--r2)", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)" }}>Paid by Bank / Cash</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(paid)}</span>
            </div>
            <div style={{ border: "1px solid var(--bd)", borderRadius: "var(--r2)", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--bd)", background: "var(--grn-lt)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", width: 88, whiteSpace: "nowrap" }}>Refund</span>
                <input
                  type="number"
                  min={0}
                  max={refundBy === "amt" ? undefined : 100}
                  value={refundIn}
                  onChange={(e) => setRefundIn(e.target.value)}
                  style={{ ...FIGURE_INPUT, width: refundBy === "amt" ? 104 : 64 }}
                />
                <PctAmtToggle value={refundBy} onChange={switchRefundBy} />
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--grn)" }}>{fmt(refundAmt)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--acc-lt)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", width: 88, whiteSpace: "nowrap" }}>Credit Note</span>
                <input
                  type="number"
                  min={0}
                  max={cnBy === "amt" ? undefined : 100}
                  value={cnIn}
                  onChange={(e) => setCnIn(e.target.value)}
                  style={{ ...FIGURE_INPUT, width: cnBy === "amt" ? 104 : 64 }}
                />
                <PctAmtToggle value={cnBy} onChange={switchCnBy} />
                {cnCode && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--acc)", background: "var(--surf)", border: "1px solid var(--bd)", borderRadius: "var(--r1)", padding: "2px 6px" }}>
                    {cnCode}
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--acc)" }}>{fmt(cnAmt)}</span>
              </div>
            </div>
            {over ? (
              <p style={{ fontSize: 11, color: "var(--red)", fontWeight: 600, marginBottom: 14 }}>
                Refund and credit note together cannot exceed the {fmt(paid)} paid.
              </p>
            ) : (
              <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 14 }}>
                Enter the share or the rupee figure agreed with the organisation; no policy is applied to B2B bookings.
                Retained as cancellation charge: <strong style={{ color: "var(--t1)" }}>{fmt(retained)}</strong>.
                Rooms and venues held on the chart are released.
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCancelOpen(false)}>Go Back</button>
              <button className="btn btn-danger" onClick={confirmCancel} disabled={over}>Confirm Cancellation</button>
            </div>
          </div>
        </div>
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
  const { bulkRoomBlocks, venueBlocks, rooms, roomInventory, venues } = useApp();
  const orgLabel =
    b.type === "School" ? "School Name" : b.type === "Institute" ? "Institute Name" : "Company Name";
  // Villas and venues the booking holds on the chart right now
  const roomBlock = b.roomBlockId ? bulkRoomBlocks.find((x) => x.id === b.roomBlockId) : undefined;
  const heldRows = (roomBlock?.rows ?? []).map((row) => ({
    name: rooms.find((r) => r.id === row.catId)?.name ?? row.catName,
    villas: row.roomIds
      .map((id) => roomInventory.find((r) => r.id === id)?.label ?? id)
      .sort(compareRoomLabels)
      .join(", "),
  }));
  const heldVenues = (b.venueBlockIds ?? [])
    .map((id) => venueBlocks.find((vb) => vb.id === id))
    .filter((vb): vb is NonNullable<typeof vb> => !!vb)
    .map((vb) => venues.find((v) => v.id === vb.venueId)?.name ?? vb.venueId);
  const askedRooms = (b.roomRows ?? []).map(
    (r) => `${r.count} ${rooms.find((x) => x.id === r.catId)?.name ?? r.catId}`
  );
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
          {heldRows.length > 0 ? (
            heldRows.map((r) => <Row key={r.name} label={r.name} value={r.villas} />)
          ) : (
            <Row
              label="Rooms"
              value={
                askedRooms.length > 0
                  ? `${askedRooms.join(", ")} · not held (${b.status})`
                  : "None"
              }
            />
          )}
          <Row label="Venues" value={heldVenues.length > 0 ? heldVenues.join(", ") : "None"} />
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
                  <th style={{ textAlign: "right" }}>TDS (₹)</th>
                </tr>
              </thead>
              <tbody>
                {b.payments.map((p, i) => (
                  <tr key={i} style={{ cursor: "default" }}>
                    <td>{fmtIN(p.date)}</td>
                    <td>{p.mode}</td>
                    <td style={{ textAlign: "right" }}>{fmt(p.amount)}</td>
                    <td style={{ textAlign: "right", color: "var(--t3)" }}>{(p.tds ?? 0) > 0 ? fmt(p.tds ?? 0) : "—"}</td>
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
          {tdsOfPayments(b.payments) > 0 && (
            <div className="detail-row">
              <span className="detail-key" style={{ fontWeight: 600 }}>
                TDS
                <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 500, marginLeft: 8 }}>withheld by client, settles the bill</span>
              </span>
              <span className="detail-val" style={{ fontWeight: 700, fontSize: 14, color: "var(--t2)" }}>
                {fmt(tdsOfPayments(b.payments))}
              </span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-key" style={{ fontWeight: 600 }}>
              {b.balance <= -1 ? "Excess Received" : "Balance"}
            </span>
            <span
              className="detail-val"
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: b.balance >= 1 ? "var(--amb)" : b.balance <= -1 ? "var(--pur)" : "var(--grn)",
              }}
            >
              {fmt(Math.abs(b.balance))}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
