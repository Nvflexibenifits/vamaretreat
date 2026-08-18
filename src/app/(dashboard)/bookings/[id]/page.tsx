"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { bookingChargesBreakdown, fmt, fmtIN, dayName, getBookingPricingRows, nightsBetween, todayStr, tryAssignRooms } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import type { CancellationDetails, CancellationPolicy, SpecialDay, WaiveOffLine } from "@/types";

// ─── helpers ───────────────────────────────────────────────────────────────

function getDatesInRange(checkin: string, checkout: string): string[] {
  const dates: string[] = [];
  const cur = new Date(checkin + "T00:00:00");
  const end = new Date(checkout + "T00:00:00");
  while (cur < end) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// dd/mm/yy — compact date format matching the revenue table convention
const CANCEL_LB: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "var(--t3)",
  textTransform: "uppercase",
  letterSpacing: ".4px",
  marginBottom: 2,
};
const CANCEL_VAL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--t1)" };
const CANCEL_PCT_INPUT: React.CSSProperties = {
  width: 64,
  height: 30,
  padding: "0 8px",
  fontSize: 13,
  textAlign: "right",
  border: "1px solid var(--bd)",
  borderRadius: "var(--r2)",
  background: "var(--surf)",
  color: "var(--t1)",
  outline: "none",
};

function fmtShort(d: string): string {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y.slice(2)}`;
}

function computeCancel(
  advance: number,
  checkin: string,
  policy: CancellationPolicy,
  specialDays: SpecialDay[],
  creditPrefix: string,
  creditNextNum: number,
  by: string,
  today: string
) {
  const stayDates = getDatesInRange(checkin, checkin); // at least check-in date
  // actually all nights:
  const allNights = getDatesInRange(checkin, checkin); // placeholder — done properly below

  // All nights in stay
  const nights = getDatesInRange(checkin, checkin); // we don't have checkout here — pass it
  // We'll receive checkout separately, see the call site

  const todayMs = new Date(today + "T00:00:00").getTime();
  const checkinMs = new Date(checkin + "T00:00:00").getTime();
  const daysBeforeCheckin = Math.max(0, Math.round((checkinMs - todayMs) / 86400000));

  const isSpecial = allNights.some((d) => specialDays.some((sd) => sd.date === d));
  const threshold = isSpecial ? policy.specialThreshold : policy.standardThreshold;
  const cell = isSpecial
    ? daysBeforeCheckin >= threshold ? policy.specialAbove : policy.specialBelow
    : daysBeforeCheckin >= threshold ? policy.standardAbove : policy.standardBelow;

  const cancellationCharge = Math.round(advance * cell.cancellationChargePct / 100);
  const refundAmount = Math.round(advance * (cell.refundPct ?? 0) / 100);
  const creditNoteAmount = Math.round(advance * (cell.creditNotePct ?? 0) / 100);
  const hasCredit = creditNoteAmount > 0;
  const creditNoteCode = hasCredit
    ? `${creditPrefix}-${String(creditNextNum).padStart(4, "0")}`
    : undefined;

  const details: CancellationDetails = {
    cancellationDate: today,
    daysBeforeCheckin,
    policyType: isSpecial ? "special" : "standard",
    cancellationCharge,
    refundAmount,
    creditNoteAmount,
    refundPct: cell.refundPct ?? 0,
    creditNotePct: cell.creditNotePct ?? 0,
    resolution: hasCredit ? "credit-note" : "refund",
    creditNoteCode,
    processedBy: by,
  };

  return { details, daysBeforeCheckin, isSpecial, threshold, cell };
}

// ─── main page ─────────────────────────────────────────────────────────────

// Waive-off modal rows: one fixed row per charge head.
type WaiveRow = { head: "room" | "meal" | "other"; label: string; amount: string; gstPct: string };

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const {
    bookings,
    rooms,
    roomInventory,
    bulkRoomBlocks,
    updateBooking,
    openModal,
    cancelBooking,
    recordRefund,
    hydrated,
    currentRole,
    currentUser,
    cancellationPolicy,
    specialDays,
    creditNoteSettings,
    showNotif,
  } = useApp();

  const isFrontOffice = currentRole === "Front Office";
  const b = bookings.find((x) => x.id === id);
  const [showCancelModal, setShowCancelModal] = useState(false);
  // Editable per-booking overrides, seeded from the policy when the modal opens
  const [cancelRefundPct, setCancelRefundPct] = useState("0");
  const [cancelCnPct, setCancelCnPct] = useState("0");
  const [today] = useState(() => todayStr());

  // Record Refund modal (cancelled bookings with a cash refund due)
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refAmount, setRefAmount] = useState("");
  const [refDate, setRefDate] = useState("");
  const [refMode, setRefMode] = useState("Bank Transfer");
  const [refNote, setRefNote] = useState("");

  // Waive-off modal (cancelled bookings: write off the unpaid balance)
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [waiveRows, setWaiveRows] = useState<WaiveRow[]>([]);

  useEffect(() => {
    if (!hydrated) return;
    if (id && !b) router.replace("/bookings");
  }, [b, id, router, hydrated]);

  const showCancel = !isFrontOffice && b?.status === "Confirmed";

  // Pre-compute cancellation breakdown for the modal — must be before early return
  const cancelCalc = useMemo(() => {
    if (!b || !showCancel) return null;
    const stayNights = getDatesInRange(b.checkin, b.checkout);
    const todayMs = new Date(today + "T00:00:00").getTime();
    const checkinMs = new Date(b.checkin + "T00:00:00").getTime();
    const daysBeforeCheckin = Math.max(0, Math.round((checkinMs - todayMs) / 86400000));
    const isSpecial = stayNights.some((d) => specialDays.some((sd) => sd.date === d));
    const threshold = isSpecial ? cancellationPolicy.specialThreshold : cancellationPolicy.standardThreshold;
    const cell = isSpecial
      ? daysBeforeCheckin >= threshold ? cancellationPolicy.specialAbove : cancellationPolicy.specialBelow
      : daysBeforeCheckin >= threshold ? cancellationPolicy.standardAbove : cancellationPolicy.standardBelow;

    const paid = b.advance;
    const cancellationCharge = Math.round(paid * cell.cancellationChargePct / 100);
    const refundAmount = Math.round(paid * (cell.refundPct ?? 0) / 100);
    const creditNoteAmount = Math.round(paid * (cell.creditNotePct ?? 0) / 100);
    const hasCredit = creditNoteAmount > 0;
    const creditNoteCode = hasCredit
      ? `${creditNoteSettings.prefix}-${String(creditNoteSettings.nextNumber).padStart(4, "0")}`
      : undefined;

    return {
      daysBeforeCheckin,
      isSpecial,
      threshold,
      policyLabel: `${isSpecial ? "Special Day" : "Standard"} — ${daysBeforeCheckin >= threshold ? "Above" : "Below"} threshold (${threshold} days)`,
      paid,
      cancellationCharge,
      refundAmount,
      creditNoteAmount,
      hasCredit,
      creditNoteCode,
      cancellationChargePct: cell.cancellationChargePct,
      refundPct: cell.refundPct,
      creditNotePct: cell.creditNotePct,
    };
  }, [b, showCancel, today, cancellationPolicy, specialDays, creditNoteSettings]);

  if (!b) return null;

  const canEdit = !isFrontOffice && (b.status === "Enquiry" || b.status === "Tentative" || b.status === "Confirmed" || b.status === "Completed");
  const showBookTentative = !isFrontOffice && b.status === "Enquiry";
  const showConfirm = !isFrontOffice && (b.status === "Tentative");

  const allocateAndSetStatus = (status: "Tentative" | "Confirmed") => {
    const result = tryAssignRooms(b.segments, b.checkin, b.checkout, bookings, roomInventory, b.id, bulkRoomBlocks, rooms);
    if (!result.ok) {
      showNotif(`No ${result.missingCategoryName} available for selected dates`, "error");
      return;
    }
    const segments = b.segments.map((s) => ({ ...s, allocatedRooms: result.perSegment[s.id] ?? [] }));
    updateBooking(b.id, { status, allocatedRooms: result.rooms, segments });
    showNotif(status === "Confirmed" ? `Booking ${b.id} confirmed` : `Booking ${b.id} marked Tentative`, "success");
  };

  const handleBookTentative = () => allocateAndSetStatus("Tentative");
  const handleConfirm = () => allocateAndSetStatus("Confirmed");

  // Cancelled bookings stay locked except for the waive-off: the unpaid
  // balance is written off across the three charge heads so the booking's
  // reported value matches what the hotel actually keeps. Refund
  // cancellations already drop their revenue, so nothing to waive there.
  const waiveTarget = Math.max(0, Math.round(b.grandTotal - b.advance));
  const canWaiveOff =
    !isFrontOffice &&
    b.status === "Cancelled" &&
    b.cancellationDetails?.resolution !== "refund" &&
    (waiveTarget > 0 || !!b.waiveOff);

  // Charge heads before any waive-off — the per-head caps for the modal
  const rawCharges = bookingChargesBreakdown({ ...b, waiveOff: undefined });

  const defaultRoomGstPct = (() => {
    const row = getBookingPricingRows(b).find((r) => r.netCharges > 0 && r.gstAmt > 0);
    return row ? String(row.gstRate) : "5";
  })();

  const openWaiveOff = () => {
    const saved = (head: WaiveRow["head"]) => b.waiveOff?.lines.find((l) => l.head === head);
    const mk = (head: WaiveRow["head"], label: string, defPct: string): WaiveRow => {
      const s = saved(head);
      return {
        head,
        label,
        amount: s ? String(s.amount) : "0",
        gstPct: s ? String(s.gstPct) : defPct,
      };
    };
    setWaiveRows([
      mk("room", "Room Charges", defaultRoomGstPct),
      mk("meal", "Meal Charges", "18"),
      mk("other", "Add-on Charges", "18"),
    ]);
    setShowWaiveModal(true);
  };

  const waiveHeadCap = (head: WaiveRow["head"]) =>
    head === "room" ? rawCharges.roomNet : head === "meal" ? rawCharges.mealNet : rawCharges.other;

  const waiveRowGross = (r: WaiveRow) => {
    const amt = parseFloat(r.amount) || 0;
    return amt + (amt * (parseFloat(r.gstPct) || 0)) / 100;
  };
  const waiveTotalGross = waiveRows.reduce((s, r) => s + waiveRowGross(r), 0);

  const saveWaiveOff = () => {
    for (const r of waiveRows) {
      const amt = parseFloat(r.amount) || 0;
      if (amt < 0) { showNotif("Waive-off amounts cannot be negative", "error"); return; }
      if (amt > waiveHeadCap(r.head) + 0.01) {
        showNotif(`${r.label}: cannot waive more than ${fmt(waiveHeadCap(r.head))} (net charges on this head)`, "error");
        return;
      }
    }
    if (Math.abs(waiveTotalGross - waiveTarget) > 1) {
      showNotif(`Total waived (incl. GST) must equal the unpaid balance of ${fmt(waiveTarget)}`, "error");
      return;
    }
    const lines: WaiveOffLine[] = waiveRows
      .map((r) => {
        const amount = Math.round((parseFloat(r.amount) || 0) * 100) / 100;
        const gstPct = parseFloat(r.gstPct) || 0;
        return { head: r.head, amount, gstPct, gstAmt: Math.round(amount * gstPct) / 100 };
      })
      .filter((l) => l.amount > 0);
    const totalGross = Math.round(lines.reduce((s, l) => s + l.amount + l.gstAmt, 0) * 100) / 100;
    updateBooking(b.id, {
      waiveOff: { lines, totalGross, date: today, by: currentUser },
      balance: Math.max(0, Math.round(b.grandTotal - totalGross - b.advance)),
    });
    setShowWaiveModal(false);
    showNotif("Unpaid balance waived off", "success");
  };

  const pricingRows = getBookingPricingRows(b);

  // Per-segment meal rows (new bookings store rates per segment); legacy
  // bookings without stored rates fall back to booking-level derived rows.
  const segMealRows = (b.segments ?? []).flatMap((seg) => {
    const segNights = nightsBetween(seg.checkin, seg.checkout);
    const dates = `${fmtIN(seg.checkin)} → ${fmtIN(seg.checkout)}`;
    const rows: { key: string; label: string; dates: string; rate: number; nights: number; pax: number; chg: number }[] = [];
    if (segNights <= 0) return rows;
    if (Array.isArray(seg.mealItems) && seg.mealItems.length > 0) {
      seg.mealItems.forEach((mi) =>
        rows.push({ key: `${seg.id}-${mi.id}`, label: mi.packageName, dates, rate: mi.rate, nights: segNights, pax: mi.pax, chg: mi.total })
      );
      if ((seg.pets ?? 0) > 0)
        rows.push({ key: `${seg.id}-pet`, label: "Pet Package", dates, rate: seg.petRate ?? 0, nights: segNights, pax: seg.pets, chg: (seg.petRate ?? 0) * segNights * seg.pets });
      return rows;
    }
    if (seg.mealOn && (seg.mealRate ?? 0) > 0 && seg.adults > 0)
      rows.push({ key: `${seg.id}-meal`, label: "Meal & Activity Package", dates, rate: seg.mealRate ?? 0, nights: segNights, pax: seg.adults, chg: (seg.mealRate ?? 0) * segNights * seg.adults });
    if ((seg.pets ?? 0) > 0)
      rows.push({ key: `${seg.id}-pet`, label: "Pet Package", dates, rate: seg.petRate ?? 0, nights: segNights, pax: seg.pets, chg: (seg.petRate ?? 0) * segNights * seg.pets });
    if (seg.driverMealOn && (seg.drivers ?? 0) > 0 && (seg.driverMealRate ?? 0) > 0)
      rows.push({ key: `${seg.id}-drv`, label: "Driver / Attendant Meal", dates, rate: seg.driverMealRate ?? 0, nights: segNights, pax: seg.drivers ?? 0, chg: (seg.driverMealRate ?? 0) * segNights * (seg.drivers ?? 0) });
    return rows;
  });
  const totalRoomBaseCharges = pricingRows.reduce((s, r) => s + r.roomCharges, 0);
  const totalDiscount = pricingRows.reduce((s, r) => s + r.discountAmt, 0);
  const totalNet = pricingRows.reduce((s, r) => s + r.netCharges, 0);
  const totalRoomGst = pricingRows.reduce((s, r) => s + r.gstAmt, 0);
  const totalGstAll = totalRoomGst + b.mealGst + b.petGst + (b.driverMealGst ?? 0);

  const roomCategoryMap = (() => {
    const m = new Map<string, number>();
    b.segments.forEach((seg) => {
      seg.rooms.forEach((r) => {
        m.set(r.roomName, Math.max(m.get(r.roomName) ?? 0, r.numRooms));
      });
    });
    return m;
  })();

  const refundPctNum = Math.max(0, Math.min(100, parseFloat(cancelRefundPct) || 0));
  const cnPctNum = Math.max(0, Math.min(100, parseFloat(cancelCnPct) || 0));
  const cancelRefundAmt = cancelCalc ? Math.round(cancelCalc.paid * refundPctNum / 100) : 0;
  const cancelCnAmt = cancelCalc ? Math.round(cancelCalc.paid * cnPctNum / 100) : 0;
  const cancelPctOver = refundPctNum + cnPctNum > 100;
  const cancelRetained = cancelCalc ? Math.max(0, cancelCalc.paid - cancelRefundAmt - cancelCnAmt) : 0;
  const cancelCnCode = cancelCnAmt > 0
    ? `${creditNoteSettings.prefix}-${String(creditNoteSettings.nextNumber).padStart(4, "0")}`
    : undefined;

  const onConfirmCancel = () => {
    if (!cancelCalc) return;
    if (cancelPctOver) {
      showNotif("Refund % + Credit Note % cannot exceed 100%", "error");
      return;
    }
    const details: CancellationDetails = {
      cancellationDate: today,
      daysBeforeCheckin: cancelCalc.daysBeforeCheckin,
      policyType: cancelCalc.isSpecial ? "special" : "standard",
      cancellationCharge: cancelRetained,
      refundAmount: cancelRefundAmt,
      creditNoteAmount: cancelCnAmt,
      refundPct: parseFloat(cancelRefundPct) || 0,
      creditNotePct: parseFloat(cancelCnPct) || 0,
      resolution: cancelRefundAmt > 0 ? "refund" : cancelCnAmt > 0 ? "credit-note" : "refund",
      creditNoteCode: cancelCnCode,
      processedBy: currentUser,
    };
    cancelBooking(b.id, details);
    setShowCancelModal(false);
    showNotif("Booking cancelled", "success");
  };

  const onConfirmRefund = () => {
    if (!b.cancellationDetails) return;
    const amt = parseFloat(refAmount);
    if (!amt || amt <= 0) {
      showNotif("Enter a valid refund amount", "error");
      return;
    }
    if (!refDate) {
      showNotif("Pick the payout date", "error");
      return;
    }
    const paidOut = (b.cancellationDetails.refundPayouts ?? []).reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, b.cancellationDetails.refundAmount - paidOut);
    if (amt > remaining) {
      showNotif(`Only ${fmt(remaining)} is due to the guest`, "error");
      return;
    }
    recordRefund(b.id, {
      date: refDate,
      amount: amt,
      mode: refMode,
      reference: refNote.trim() || undefined,
      by: currentUser,
    });
    setShowRefundModal(false);
    showNotif(`Refund of ${fmt(amt)} recorded`, "success");
  };

  return (
    <div className="view">
      {/* Record Refund Modal */}
      {showWaiveModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowWaiveModal(false); }}>
          <div className="modal" style={{ maxWidth: 680, width: "100%" }}>
            <h3>Waive Off Unpaid Balance</h3>
            <p className="modal-desc">
              Write the unpaid balance off across the charge heads. Original figures stay on record; the booking value and Revenue Register report the reduced amounts.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1, padding: "8px 12px", background: "var(--surf2)", borderRadius: "var(--r3)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase" }}>To Waive (incl. GST)</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt(waiveTarget)}</div>
              </div>
              <div style={{ flex: 1, padding: "8px 12px", background: "var(--surf2)", borderRadius: "var(--r3)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase" }}>Allocated</div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{fmt(waiveTotalGross)}</div>
              </div>
              <div style={{ flex: 1, padding: "8px 12px", background: Math.abs(waiveTarget - waiveTotalGross) <= 1 ? "var(--grn-bg)" : "var(--amb-bg)", borderRadius: "var(--r3)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase" }}>Remaining</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: Math.abs(waiveTarget - waiveTotalGross) <= 1 ? "var(--grn)" : "var(--amb)" }}>
                  {fmt(Math.max(0, waiveTarget - waiveTotalGross))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, overflowX: "auto" }}>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Charge Head</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Available (net)</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Waive Amount (₹)</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST %</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Incl. GST</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {waiveRows.map((row) => {
                    const cap = waiveHeadCap(row.head);
                    const amt = parseFloat(row.amount) || 0;
                    const overCap = amt > cap + 0.01;
                    return (
                      <tr key={row.head}>
                        <td style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{row.label}</td>
                        <td style={{ textAlign: "right", fontSize: 12, color: "var(--t3)", whiteSpace: "nowrap" }}>{fmt(cap)}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            value={row.amount}
                            onChange={(e) => setWaiveRows((p) => p.map((r) => r.head === row.head ? { ...r, amount: e.target.value } : r))}
                            style={{ width: 110, padding: "5px 8px", border: `1px solid ${overCap ? "var(--red)" : "var(--bd)"}`, borderRadius: "var(--r3)", fontSize: 12, textAlign: "right", background: "var(--surf)", outline: "none" }}
                          />
                          {overCap && (
                            <div style={{ fontSize: 10, color: "var(--red)", marginTop: 2 }}>Exceeds available</div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            max={28}
                            value={row.gstPct}
                            onChange={(e) => setWaiveRows((p) => p.map((r) => r.head === row.head ? { ...r, gstPct: e.target.value } : r))}
                            style={{ width: 64, padding: "5px 8px", border: "1px solid var(--bd)", borderRadius: "var(--r3)", fontSize: 12, textAlign: "right", background: "var(--surf)", outline: "none" }}
                          />
                        </td>
                        <td style={{ textAlign: "right", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{fmt(waiveRowGross(row))}</td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            title="Fill this row with the remaining amount"
                            onClick={() => {
                              const othersGross = waiveRows.filter((r) => r.head !== row.head).reduce((s, r) => s + waiveRowGross(r), 0);
                              const pct = parseFloat(row.gstPct) || 0;
                              const base = Math.max(0, (waiveTarget - othersGross) / (1 + pct / 100));
                              const capped = Math.min(base, waiveHeadCap(row.head));
                              setWaiveRows((p) => p.map((r) => r.head === row.head ? { ...r, amount: String(Math.round(capped * 100) / 100) } : r));
                            }}
                          >
                            Fill
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>
              Fill computes the amount so that amount plus its GST settles the remaining balance exactly.
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setShowWaiveModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveWaiveOff} disabled={Math.abs(waiveTotalGross - waiveTarget) > 1}>
                Waive Off {fmt(waiveTotalGross)}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefundModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRefundModal(false);
          }}
        >
          <div className="modal modal-sm">
            <h3>Record Refund</h3>
            <p className="modal-desc">
              {b.guest} · {b.id}
            </p>
            <div className="fg" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Amount (₹) *</label>
                <input
                  type="number"
                  min={1}
                  value={refAmount}
                  onChange={(e) => setRefAmount(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Payout Date *</label>
                <input
                  type="date"
                  value={refDate}
                  onChange={(e) => setRefDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Mode</label>
                <select value={refMode} onChange={(e) => setRefMode(e.target.value)}>
                  <option>Bank Transfer</option>
                  <option>UPI / QR</option>
                  <option>Cash</option>
                </select>
              </div>
              <div className="field">
                <label>Reference</label>
                <input
                  type="text"
                  value={refNote}
                  onChange={(e) => setRefNote(e.target.value)}
                  placeholder="UTR / note (optional)"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowRefundModal(false)}>Cancel</button>
              <button className="btn btn-success" onClick={onConfirmRefund}>Record Refund</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && cancelCalc && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "var(--surf)", borderRadius: "var(--r3)",
              border: "1px solid var(--bd)", padding: 28, width: 520,
              maxWidth: "calc(100vw - 32px)", boxShadow: "0 8px 32px rgba(0,0,0,.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <h3 style={{ color: "var(--red)" }}>Cancel Booking</h3>
              <span style={{ fontSize: 12, color: "var(--t2)" }}>
                Date: <strong style={{ color: "var(--t1)" }}>{fmtIN(today)}</strong>
              </span>
            </div>

            {/* Booking details */}
            <div style={{ border: "1px solid var(--bd)", borderRadius: "var(--r2)", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ padding: "8px 14px" }}>
                  <div style={CANCEL_LB}>Guest Name</div>
                  <div style={CANCEL_VAL}>{b.guest}</div>
                </div>
                <div style={{ padding: "8px 14px", borderLeft: "1px solid var(--bd)" }}>
                  <div style={CANCEL_LB}>Booking ID</div>
                  <div style={CANCEL_VAL}>{b.id}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ padding: "8px 14px" }}>
                  <div style={CANCEL_LB}>Check-in Date</div>
                  <div style={CANCEL_VAL}>{fmtIN(b.checkin)}</div>
                </div>
                <div style={{ padding: "8px 14px", borderLeft: "1px solid var(--bd)" }}>
                  <div style={CANCEL_LB}>Days Before Check-in</div>
                  <div style={CANCEL_VAL}>{cancelCalc.daysBeforeCheckin}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--surf2)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)" }}>Advance Amount Paid</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(cancelCalc.paid)}</span>
              </div>
            </div>

            {/* Refund / Credit Note — % editable for this booking */}
            <div style={{ border: "1px solid var(--bd)", borderRadius: "var(--r2)", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--bd)", background: "var(--grn-lt)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", width: 88 }}>Refund</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={cancelRefundPct}
                  onChange={(e) => setCancelRefundPct(e.target.value)}
                  style={CANCEL_PCT_INPUT}
                />
                <span style={{ fontSize: 12, color: "var(--t3)" }}>%</span>
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--grn)" }}>{fmt(cancelRefundAmt)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--acc-lt)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", width: 88 }}>Credit Note</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={cancelCnPct}
                  onChange={(e) => setCancelCnPct(e.target.value)}
                  style={CANCEL_PCT_INPUT}
                />
                <span style={{ fontSize: 12, color: "var(--t3)" }}>%</span>
                {cancelCnCode && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--acc)", background: "var(--surf)", border: "1px solid var(--bd)", borderRadius: "var(--r1)", padding: "2px 6px" }}>
                    {cancelCnCode}
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "var(--acc)" }}>{fmt(cancelCnAmt)}</span>
              </div>
            </div>

            {cancelPctOver ? (
              <p style={{ fontSize: 11, color: "var(--red)", fontWeight: 600, marginBottom: 14 }}>
                Refund % + Credit Note % cannot exceed 100%.
              </p>
            ) : (
              <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 14 }}>
                Prefilled from policy: {cancelCalc.policyLabel}. Edit the % above to override for this booking only.
                {cancelRetained > 0 && (
                  <> Retained as cancellation charge: <strong style={{ color: "var(--t1)" }}>{fmt(cancelRetained)}</strong>.</>
                )}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCancelModal(false)}>
                Go Back
              </button>
              <button className="btn btn-danger btn-sm" onClick={onConfirmCancel} disabled={cancelPctOver}>
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pg-hd">
        <div>
          <h2>{b.guest}</h2>
          <p>{b.id}</p>
        </div>
        <Link href="/bookings" className="btn btn-sm" style={{ background: "var(--sb)", color: "#fff", border: "none" }}>Booking List</Link>
      </div>

      <div>
        <div className="status-bar">
          <span><StatusBadge status={b.status} /></span>
          {b.status === "Lost" && b.lostReason && (
            <span style={{ fontSize: 12, color: "var(--red)" }}>Reason: {b.lostReason}</span>
          )}
          <div className="status-actions">
            {canEdit && (
              <Link href={`/bookings/${b.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
            )}
            {canWaiveOff && (
              <button className="btn btn-ghost btn-sm" onClick={openWaiveOff}>
                {b.waiveOff ? "Edit Waive Off" : "Waive Off Balance"}
              </button>
            )}
            <a
              className="btn btn-ghost btn-sm"
              href={`/bookings/${b.id}/confirmation`}
              target="_blank"
              rel="noreferrer"
            >
              View Pricing
            </a>
            {showBookTentative && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleBookTentative}
              >
                Book Tentatively
              </button>
            )}
            {showConfirm && (
              <button
                className="btn btn-accent btn-sm"
                onClick={handleConfirm}
              >
                Confirm Booking
              </button>
            )}
            {showCancel && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  if (cancelCalc) {
                    setCancelRefundPct(String(cancelCalc.refundPct ?? 0));
                    setCancelCnPct(String(cancelCalc.creditNotePct ?? 0));
                  }
                  setShowCancelModal(true);
                }}
              >
                Cancel
              </button>
            )}
            {!isFrontOffice && (b.status === "Enquiry" || b.status === "Tentative") && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => openModal({ kind: "lost", bookingId: b.id })}
              >
                Mark Lost
              </button>
            )}
          </div>
        </div>

        {/* Cancellation Summary (shown when booking is already cancelled) */}
        {b.status === "Cancelled" && b.cancellationDetails && (
          <div className="detail-panel" style={{ marginTop: 16, borderColor: "var(--red)" }}>
            <div className="detail-panel-hd"><h3 style={{ color: "var(--red)" }}>Cancellation Summary</h3></div>
            <div className="detail-panel-body">
              <div className="detail-row">
                <span className="detail-key">Cancelled On</span>
                <span className="detail-val">{fmtIN(b.cancellationDetails.cancellationDate)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Days Before Check-in</span>
                <span className="detail-val">{b.cancellationDetails.daysBeforeCheckin}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Policy</span>
                <span className="detail-val">
                  {(() => {
                    const cd = b.cancellationDetails;
                    // Percentages actually applied; older cancellations
                    // without stored pcts derive them from the amounts.
                    const paid = b.advance || 0;
                    const rp = cd.refundPct ?? (paid > 0 ? Math.round((cd.refundAmount / paid) * 100) : 0);
                    const cp = cd.creditNotePct ?? (paid > 0 ? Math.round((cd.creditNoteAmount / paid) * 100) : 0);
                    const parts = [];
                    if (rp > 0) parts.push(`Refund ${rp}%`);
                    if (cp > 0) parts.push(`Credit Note ${cp}%`);
                    return parts.length > 0 ? parts.join(" · ") : "No refund / credit note";
                  })()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Amount Received</span>
                <span className="detail-val">{fmt(b.advance)}</span>
              </div>
              {b.cancellationDetails.cancellationCharge > 0 && (
                <div className="detail-row">
                  <span className="detail-key">Cancellation Charge</span>
                  <span className="detail-val" style={{ color: "var(--red)" }}>
                    {fmt(b.cancellationDetails.cancellationCharge)}
                  </span>
                </div>
              )}
              {b.cancellationDetails.refundAmount > 0 && (() => {
                const payouts = b.cancellationDetails.refundPayouts ?? [];
                const paidOut = payouts.reduce((s, p) => s + p.amount, 0);
                const remaining = Math.max(0, b.cancellationDetails.refundAmount - paidOut);
                return (
                  <>
                    <div className="detail-row">
                      <span className="detail-key">Refund to Guest</span>
                      <span className="detail-val" style={{ color: "var(--grn)", fontWeight: 700 }}>
                        {fmt(b.cancellationDetails.refundAmount)}
                      </span>
                    </div>
                    {payouts.map((p, i) => (
                      <div className="detail-row" key={i}>
                        <span className="detail-key">Refund Paid</span>
                        <span className="detail-val">
                          {fmt(p.amount)}
                          <span style={{ fontSize: 11, marginLeft: 8, color: "var(--t3)" }}>
                            {fmtIN(p.date)} · {p.mode} · by {p.by}
                            {p.reference ? ` · ${p.reference}` : ""}
                          </span>
                        </span>
                      </div>
                    ))}
                    <div className="detail-row">
                      <span className="detail-key">Refund Status</span>
                      <span className="detail-val" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        {remaining > 0 ? (
                          <>
                            <span style={{ color: "var(--amb)", fontWeight: 700 }}>
                              Pending · {fmt(remaining)} due
                            </span>
                            {!isFrontOffice && (
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => {
                                  setRefAmount(String(remaining));
                                  setRefDate(today);
                                  setRefMode("Bank Transfer");
                                  setRefNote("");
                                  setShowRefundModal(true);
                                }}
                              >
                                Record Refund
                              </button>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "var(--grn)", fontWeight: 700 }}>Paid</span>
                        )}
                      </span>
                    </div>
                  </>
                );
              })()}
              {b.cancellationDetails.creditNoteAmount > 0 && (
                <div className="detail-row">
                  <span className="detail-key">Credit Note</span>
                  <span className="detail-val" style={{ color: "var(--acc)", fontWeight: 700 }}>
                    {fmt(b.cancellationDetails.creditNoteAmount)}
                    {b.cancellationDetails.creditNoteCode && (
                      <span style={{ fontSize: 11, marginLeft: 8, color: "var(--t3)" }}>
                        · {b.cancellationDetails.creditNoteCode}
                      </span>
                    )}
                  </span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-key">Processed By</span>
                <span className="detail-val">{b.cancellationDetails.processedBy}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Booking Confirmation Layout ── */}
        <div className="detail-panel" style={{ marginTop: 16 }}>

          {/* Guest Info — stay dates, nights, and pax live in Accommodation Charges below */}
          <div>
            <BkgRow label="Guest Name" value={b.guest} />
            <BkgRow label="Mobile No." value={b.mobile} />
            {b.email && <BkgRow label="Email" value={b.email} />}
            <BkgRow label="Source" value={b.source || "—"} last />
          </div>

          {/* PAX Count — one row per date range, before charges */}
          <SectionHeader>PAX Count</SectionHeader>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--bd)" }}>
                  {[
                    { h: "C-in", left: true },
                    { h: "C-out", left: true },
                    { h: "AD", left: false },
                    { h: "Sr. Ct", left: false },
                    { h: "K > 10", left: false },
                    { h: "K 6-10", left: false },
                    { h: "K 2-6", left: false },
                    { h: "Inf < 2", left: false },
                    { h: "Pets", left: false },
                  ].map(({ h, left }, i) => (
                    <th key={i} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".3px", textAlign: left ? "left" : "center", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(b.segments?.length ? b.segments : [null]).map((seg, i) => {
                  const counts = seg
                    ? {
                        checkin: seg.checkin, checkout: seg.checkout,
                        adults: seg.adults, seniors: seg.seniors, kidsAbove10: seg.kidsAbove10,
                        kids6to10: seg.kids6to10, kids2to6: seg.kids2to6, infants: seg.infantsBelow2, pets: seg.pets,
                      }
                    : {
                        checkin: b.checkin, checkout: b.checkout,
                        adults: b.adults, seniors: b.seniors, kidsAbove10: b.kidsAbove10,
                        kids6to10: b.kids6to10, kids2to6: b.kids2to6, infants: b.infantsBelow2, pets: b.pets,
                      };
                  const num = (v: number) => (
                    <span style={{ fontWeight: v > 0 ? 700 : 500, color: v > 0 ? "var(--t1)" : "var(--t4)" }}>{v}</span>
                  );
                  return (
                    <tr key={seg?.id ?? i} style={{ borderBottom: "1px solid var(--bd)" }}>
                      <td style={{ padding: "8px 10px", fontSize: 12, whiteSpace: "nowrap" }}>
                        <div>{fmtShort(counts.checkin)}</div>
                        <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{dayName(counts.checkin)}</div>
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, whiteSpace: "nowrap" }}>
                        <div>{fmtShort(counts.checkout)}</div>
                        <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{dayName(counts.checkout)}</div>
                      </td>
                      <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "center" }}>{num(counts.adults)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "center" }}>{num(counts.seniors)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "center" }}>{num(counts.kidsAbove10)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "center" }}>{num(counts.kids6to10)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "center" }}>{num(counts.kids2to6)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "center" }}>{num(counts.infants)}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "center" }}>{num(counts.pets)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Accommodation Charges — exact Excel column order */}
          <SectionHeader>Accommodation Charges</SectionHeader>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--bd)" }}>
                  {[
                    { h: "Category",  left: true  },
                    { h: "C-in",      left: false },
                    { h: "C-out",     left: false },
                    { h: "Nights",    left: false },
                    { h: "Rate",      left: false },
                    { h: "Disc %",    left: false },
                    { h: "Net Rate",  left: false },
                    { h: "Rooms",     left: false },
                    { h: "Charges",   left: false },
                    { h: "GST %",     left: false },
                    { h: "GST Amt",   left: false },
                    { h: "Total",     left: false },
                  ].map(({ h, left }) => (
                    <th key={h} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".3px", textAlign: left ? "left" : "right", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pricingRows.length === 0 ? (
                  <tr><td colSpan={12} style={{ padding: "14px 10px", color: "var(--t3)", fontSize: 12, textAlign: "center" }}>No pricing rows</td></tr>
                ) : (
                  pricingRows.map((r, i) => {
                    const netRatePerNight = r.nights > 0 && r.numRooms > 0
                      ? Math.round(r.netCharges / r.nights / r.numRooms)
                      : r.tariff;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--bd)" }}>
                        <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--t1)", fontWeight: 500 }}>{r.roomName}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ lineHeight: 1.3 }}>
                            <div>{fmtShort(r.checkin || b.checkin)}</div>
                            <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{dayName(r.checkin || b.checkin)}</div>
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ lineHeight: 1.3 }}>
                            <div>{fmtShort(r.checkout || b.checkout)}</div>
                            <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{dayName(r.checkout || b.checkout)}</div>
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{r.nights}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{fmt(r.tariff)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{r.discountPct > 0 ? `${r.discountPct}%` : "—"}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{fmt(netRatePerNight)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{r.numRooms}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{fmt(r.netCharges)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{r.gstRate}%</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{fmt(r.gstAmt)}</td>
                        <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", fontWeight: 700, color: "var(--t1)" }}>{fmt(r.totalAmt)}</td>
                      </tr>
                    );
                  })
                )}
                <tr style={{ background: "var(--surf2)", fontWeight: 700, borderTop: "2px solid var(--bd)" }}>
                  <td style={{ padding: "9px 10px", fontSize: 12, color: "var(--t1)" }}>Total Room Charges</td>
                  <td colSpan={7} style={{ padding: "9px 10px" }}></td>
                  <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right" }}>{fmt(totalNet)}</td>
                  <td style={{ padding: "9px 10px" }}></td>
                  <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right" }}>{fmt(totalRoomGst)}</td>
                  <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right", color: "var(--t1)" }}>{fmt(pricingRows.reduce((s, r) => s + r.totalAmt, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Meal / Pet Charges — same 12-col structure as Excel row 19 */}
          {(b.mealOn || (b.pets||0)>0 || (b.driverMealOn??false)) && (
            <>
              <SectionHeader>Meal &amp; Other Charges</SectionHeader>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                  <thead>
                    <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--bd)" }}>
                      {[
                        { h: "Charge Type", left: true  },
                        { h: "Rate",        left: false },
                        { h: "Nights",      left: false },
                        { h: "Pax",         left: false },
                        { h: "Charges",     left: false },
                        { h: "",                    left: false },
                        { h: "",                    left: false },
                        { h: "",                    left: false },
                        { h: "",                    left: false },
                        { h: "GST %",   left: false },
                        { h: "GST Amt", left: false },
                        { h: "Total",   left: false },
                      ].map(({ h }, i) => (
                        <th key={i} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".3px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {segMealRows.length > 0 && segMealRows.map((row) => (
                      <tr key={row.key} style={{ borderBottom: "1px solid var(--bd)" }}>
                        <td style={{ padding:"8px 10px",fontSize:12,color:"var(--t1)",fontWeight:500 }}>
                          {row.label}
                          <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{row.dates}</div>
                        </td>
                        <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(row.rate)}</td>
                        <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{row.nights}</td>
                        <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{row.pax}</td>
                        <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(row.chg)}</td>
                        <td></td><td></td><td></td><td></td>
                        <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>18%</td>
                        <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(row.chg*0.18)}</td>
                        <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right",fontWeight:700 }}>{fmt(row.chg*1.18)}</td>
                      </tr>
                    ))}
                    {segMealRows.length === 0 && b.mealOn && (() => {
                      const chg = b.mealTotal; const gst = b.mealGst;
                      return (
                        <tr style={{ borderBottom: "1px solid var(--bd)" }}>
                          <td style={{ padding:"8px 10px",fontSize:12,color:"var(--t1)",fontWeight:500 }}>Meal &amp; Activity Package</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.adults&&b.nights?fmt(Math.round(chg/b.nights/b.adults)):"—"}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.nights}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.adults}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(chg)}</td>
                          <td></td><td></td><td></td><td></td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>18%</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(gst)}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right",fontWeight:700 }}>{fmt(chg+gst)}</td>
                        </tr>
                      );
                    })()}
                    {segMealRows.length === 0 && (b.pets||0)>0 && (() => {
                      const chg = b.petTotal||0; const gst = b.petGst||0;
                      return (
                        <tr style={{ borderBottom: "1px solid var(--bd)" }}>
                          <td style={{ padding:"8px 10px",fontSize:12,color:"var(--t1)",fontWeight:500 }}>Pet Package</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.pets&&b.nights?fmt(Math.round(chg/b.nights/b.pets)):"—"}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.nights}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.pets}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(chg)}</td>
                          <td></td><td></td><td></td><td></td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>18%</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(gst)}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right",fontWeight:700 }}>{fmt(chg+gst)}</td>
                        </tr>
                      );
                    })()}
                    {segMealRows.length === 0 && (b.driverMealOn??false)&&(b.driverCount??0)>0 && (() => {
                      const chg = b.driverMealTotal??0; const gst = b.driverMealGst??0;
                      return (
                        <tr style={{ borderBottom: "1px solid var(--bd)" }}>
                          <td style={{ padding:"8px 10px",fontSize:12,color:"var(--t1)",fontWeight:500 }}>Driver / Attendant Meal</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.driverCount&&b.nights?fmt(Math.round(chg/b.nights/b.driverCount)):"—"}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.nights}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{b.driverCount}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(chg)}</td>
                          <td></td><td></td><td></td><td></td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>18%</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right" }}>{fmt(gst)}</td>
                          <td style={{ padding:"8px 10px",fontSize:12,textAlign:"right",fontWeight:700 }}>{fmt(chg+gst)}</td>
                        </tr>
                      );
                    })()}
                    <tr style={{ background: "var(--surf2)", fontWeight: 700, borderTop: "2px solid var(--bd)" }}>
                      <td colSpan={4} style={{ padding:"9px 10px",fontSize:12,color:"var(--t1)" }}>Total Meal Charges</td>
                      <td style={{ padding:"9px 10px",fontSize:12,textAlign:"right" }}>{fmt((b.mealOn?b.mealTotal:0)+(b.petTotal||0)+(b.driverMealTotal??0))}</td>
                      <td></td><td></td><td></td><td></td>
                      <td></td>
                      <td style={{ padding:"9px 10px",fontSize:12,textAlign:"right" }}>{fmt((b.mealOn?b.mealGst:0)+(b.petGst||0)+(b.driverMealGst??0))}</td>
                      <td style={{ padding:"9px 10px",fontSize:12,textAlign:"right",color:"var(--t1)" }}>{fmt((b.mealOn?b.mealTotal+b.mealGst:0)+((b.petTotal||0)+(b.petGst||0))+((b.driverMealTotal??0)+(b.driverMealGst??0)))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Add-on Charges — itemized extras saved on the booking */}
          {(b.extras ?? []).length > 0 && (
            <>
              <SectionHeader>Add-on Charges</SectionHeader>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
                  <thead>
                    <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--bd)" }}>
                      {["Charge", "", "", "", "Charges", "", "", "", "", "GST %", "GST Amt", "Total"].map((h, i) => (
                        <th key={i} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".3px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(b.extras ?? []).map((e, i) => {
                      const gst = e.gst ?? 0;
                      const pct = e.amount > 0 ? Math.round((gst / e.amount) * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--bd)" }}>
                          <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--t1)", fontWeight: 500 }}>
                            {e.name}
                            <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{fmtIN(e.date)} · {e.by}</div>
                          </td>
                          <td></td><td></td><td></td>
                          <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{fmt(e.amount)}</td>
                          <td></td><td></td><td></td><td></td>
                          <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{pct}%</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{fmt(gst)}</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", fontWeight: 700 }}>{fmt(e.amount + gst)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "var(--surf2)", fontWeight: 700, borderTop: "2px solid var(--bd)" }}>
                      <td colSpan={4} style={{ padding: "9px 10px", fontSize: 12, color: "var(--t1)" }}>Total Add-on Charges</td>
                      <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right" }}>{fmt((b.extras ?? []).reduce((s, e) => s + e.amount, 0))}</td>
                      <td></td><td></td><td></td><td></td>
                      <td></td>
                      <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right" }}>{fmt((b.extras ?? []).reduce((s, e) => s + (e.gst ?? 0), 0))}</td>
                      <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right", color: "var(--t1)" }}>{fmt((b.extras ?? []).reduce((s, e) => s + e.amount + (e.gst ?? 0), 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* OTA Deductions — commission / TDS / special discount withheld */}
          {(b.deductions ?? []).length > 0 && (
            <>
              <SectionHeader>Deductions (OTA)</SectionHeader>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surf2)", borderBottom: "2px solid var(--bd)" }}>
                      {["Deduction", "Amount", "GST %", "GST Amt", "Total"].map((h, i) => (
                        <th key={i} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".3px", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(b.deductions ?? []).map((d, i) => {
                      const pct = d.amount > 0 ? Math.round((d.gst / d.amount) * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--bd)" }}>
                          <td style={{ padding: "8px 10px", fontSize: 12, color: "var(--t1)", fontWeight: 500 }}>
                            {d.type}
                            <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{fmtIN(d.date)} · {d.by}</div>
                          </td>
                          <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", color: "var(--red)" }}>−{fmt(d.amount)}</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right" }}>{pct}%</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", color: "var(--red)" }}>−{fmt(d.gst)}</td>
                          <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", fontWeight: 700, color: "var(--red)" }}>−{fmt(d.amount + d.gst)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: "var(--surf2)", fontWeight: 700, borderTop: "2px solid var(--bd)" }}>
                      <td style={{ padding: "9px 10px", fontSize: 12, color: "var(--t1)" }}>Total Deductions</td>
                      <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right", color: "var(--red)" }}>
                        −{fmt((b.deductions ?? []).reduce((s, d) => s + d.amount, 0))}
                      </td>
                      <td></td>
                      <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right", color: "var(--red)" }}>
                        −{fmt((b.deductions ?? []).reduce((s, d) => s + d.gst, 0))}
                      </td>
                      <td style={{ padding: "9px 10px", fontSize: 12, textAlign: "right", color: "var(--red)" }}>
                        −{fmt((b.deductions ?? []).reduce((s, d) => s + d.amount + d.gst, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Grand Total / Advance / Balance */}
          <div style={{ borderTop: "2px solid var(--bd)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--amb-lt)", borderBottom: "1px solid var(--bd)" }}>
              <span style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontWeight: 800, fontSize: 13, color: "var(--t1)" }}>
                Total Amount Payable
              </span>
              <span style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontWeight: 800, fontSize: 18, color: "var(--t1)" }}>
                {fmt(b.grandTotal)}
              </span>
            </div>
            {b.waiveOff && (
              <>
                {b.waiveOff.lines.map((l) => (
                  <div key={l.head} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--bd)" }}>
                    <span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600 }}>
                      Waived Off — {l.head === "room" ? "Room Charges" : l.head === "meal" ? "Meal Charges" : "Add-on Charges"}
                      <span style={{ color: "var(--t3)", fontWeight: 500 }}> ({fmt(l.amount)} + {l.gstPct}% GST)</span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>−{fmt(l.amount + l.gstAmt)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "var(--surf2)", borderBottom: "1px solid var(--bd)" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>
                    Net Value After Waive Off
                    <span style={{ color: "var(--t3)", fontWeight: 500 }}> · {fmtIN(b.waiveOff.date)} by {b.waiveOff.by}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--t1)" }}>{fmt(b.grandTotal - b.waiveOff.totalGross)}</span>
                </div>
              </>
            )}
            {(b.deductions ?? []).length > 0 && (() => {
              const dedTotal = (b.deductions ?? []).reduce((s, d) => s + d.amount + d.gst, 0);
              const net = b.grandTotal - (b.waiveOff?.totalGross ?? 0) - dedTotal;
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px", borderBottom: "1px solid var(--bd)" }}>
                    <span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600 }}>
                      Deductions (OTA)
                      <span style={{ color: "var(--t3)", fontWeight: 500 }}> — {(b.deductions ?? []).map((d) => d.type).join(", ")}</span>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)" }}>−{fmt(dedTotal)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "var(--surf2)", borderBottom: "1px solid var(--bd)" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>Net Receivable</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "var(--t1)" }}>{fmt(net)}</span>
                  </div>
                </>
              );
            })()}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid var(--bd)" }}>
              <span style={{ fontSize: 12, color: "var(--t2)", fontWeight: 600 }}>Amount Received</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--grn)" }}>{fmt(b.advance)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: b.balance >= 1 ? "var(--amb-lt)" : "var(--grn-lt)" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: b.balance >= 1 ? "var(--amb)" : "var(--grn)" }}>
                {b.balance >= 1 ? "Balance Amount" : "Fully Paid"}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: b.balance >= 1 ? "var(--amb)" : "var(--grn)" }}>
                {b.balance >= 1 ? fmt(b.balance) : "Paid"}
              </span>
            </div>
          </div>

          {/* Meal Preference + Special Request */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderTop: "1px solid var(--bd)" }}>
            <div style={{ padding: "12px 16px", borderRight: "1px solid var(--bd)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Meals</div>
              <div style={{ fontSize: 13, color: "var(--t1)" }}>{b.mealOn ? "Included" : "Not included"}</div>
            </div>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>Special Request</div>
              <div style={{ fontSize: 13, color: "var(--t1)" }}>{b.notes || "—"}</div>
            </div>
          </div>

        </div>

        {/* Room Reassignments */}
        {b.nightOverrides && b.nightOverrides.length > 0 && (
          <div className="detail-panel" style={{ marginTop: 16 }}>
            <div className="detail-panel-hd"><h3>Room Reassignments</h3></div>
            <div className="detail-panel-body">
              {[...b.nightOverrides]
                .sort((a, b2) => (a.date < b2.date ? -1 : 1))
                .map((o) => {
                  const fromInv = roomInventory.find((r) => r.id === o.fromRoomId);
                  const toInv = roomInventory.find((r) => r.id === o.toRoomId);
                  return (
                    <div key={`${o.date}-${o.fromRoomId}`} style={{ padding: "10px 0", borderBottom: "1px solid var(--bd)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>
                          {fmtIN(o.date)}
                        </span>
                        {o.upgrade ? (
                          o.upgrade.kind === "complimentary" ? (
                            <span className="badge" style={{ background: "var(--grn-bg)", color: "var(--grn)" }}>Complimentary Upgrade</span>
                          ) : (
                            <span className="badge" style={{ background: "var(--amb-bg)", color: "var(--amb)" }}>Paid Upgrade</span>
                          )
                        ) : (
                          <span className="badge" style={{ background: "var(--surf3)", color: "var(--t2)" }}>Room Swap (Same Category)</span>
                        )}
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">Originally Booked</span>
                        <span className="detail-val">
                          {fromInv?.label || o.fromRoomId}
                          {o.upgrade ? ` (${o.upgrade.fromCategoryName})` : fromInv ? ` (${fromInv.type})` : ""}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">Reassigned To</span>
                        <span className="detail-val" style={{ fontWeight: 600 }}>
                          {toInv?.label || o.toRoomId}
                          {o.upgrade ? ` (${o.upgrade.toCategoryName})` : toInv ? ` (${toInv.type})` : ""}
                        </span>
                      </div>
                      {o.upgrade && o.upgrade.kind === "complimentary" && (
                        <div className="detail-row">
                          <span className="detail-key">Reason</span>
                          <span className="detail-val" style={{ color: "var(--t2)" }}>{o.upgrade.reason || "—"}</span>
                        </div>
                      )}
                      {o.upgrade && o.upgrade.kind === "paid" && (
                        <div className="detail-row">
                          <span className="detail-key">Upgrade Charge</span>
                          <span className="detail-val" style={{ fontWeight: 700, color: "var(--amb)" }}>{fmt(o.upgrade.extraAmount)}</span>
                        </div>
                      )}
                      {o.upgrade && (
                        <div className="detail-row">
                          <span className="detail-key">Updated</span>
                          <span className="detail-val">{fmtIN(o.upgrade.upgradeDate)} by {o.upgrade.by}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--sb)", color: "#fff",
      padding: "8px 16px",
      fontFamily: "var(--font-outfit), Outfit, sans-serif",
      fontWeight: 700, fontSize: 12, letterSpacing: ".5px", textTransform: "uppercase",
      borderTop: "1px solid var(--bd)",
    }}>
      {children}
    </div>
  );
}

function BkgRow({ label, value, sub, last }: { label: string; value: string; sub?: string; last?: boolean }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "150px 1fr",
      borderBottom: last ? "none" : "1px solid var(--bd)",
    }}>
      <div style={{ padding: "7px 12px", background: "var(--surf2)", fontSize: 11, fontWeight: 700, color: "var(--t3)", borderRight: "1px solid var(--bd)" }}>
        {label}
      </div>
      <div style={{ padding: "7px 12px", fontSize: 12, color: "var(--t1)", fontWeight: 500, lineHeight: 1.3 }}>
        {value}
        {sub && <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}
