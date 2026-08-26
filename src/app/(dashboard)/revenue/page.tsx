"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { bookingChargesBreakdown, countsAsRevenue, fmt, todayStr } from "@/lib/utils";

// dd/mm/yy
function fmtShort(d: string): string {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y.slice(2)}`;
}

function nfmt(v: number): string {
  return Math.round(v).toLocaleString("en-IN");
}

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

const groupHdStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".5px",
  color: "var(--t2)",
  background: "var(--surf3)",
  textAlign: "left",
  borderBottom: "1px solid var(--bd)",
};

const sectionBorder: React.CSSProperties = { borderLeft: "2px solid var(--bd)" };

export default function RevenuePage() {
  const { bookings, currentRole, addOnCategories } = useApp();
  const [search, setSearch] = useState("");
  const [today, setToday] = useState("");
  // "" = current month, "custom" = manual range, otherwise "YYYY-MM"
  const [month, setMonth] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    setToday(todayStr());
  }, []);

  const effMonth = month || (today ? today.slice(0, 7) : "");
  const rangeFrom = month === "custom" ? dateFrom : effMonth ? `${effMonth}-01` : "";
  const rangeTo = month === "custom" ? dateTo : effMonth ? lastDayOfMonth(effMonth) : "";

  // Month options: 3 months ahead down to 12 months back
  const monthOptions = useMemo(() => {
    if (!today) return [];
    const base = new Date(today + "T00:00:00");
    return Array.from({ length: 16 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + 3 - i, 1);
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      };
    });
  }, [today]);

  // Confirmed, Completed and Cancelled count as revenue — see countsAsRevenue
  const tableRows = useMemo(() => {
    return bookings
      .filter(countsAsRevenue)
      .filter((b) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!b.id.toLowerCase().includes(q) && !b.guest.toLowerCase().includes(q)) return false;
        }
        if (rangeFrom && b.checkin < rangeFrom) return false;
        if (rangeTo && b.checkin > rangeTo) return false;
        return true;
      })
      .sort((a, b) => a.checkin.localeCompare(b.checkin))
      .map((b) => {
        const isCancelled = b.status === "Cancelled";
        // Refund cancellations remove the booking's revenue (only a
        // cancellation charge, if any, is kept). Credit-note cancellations
        // keep full revenue: no money leaves, the stay obligation remains.
        const isRefundCancel = isCancelled && b.cancellationDetails?.resolution === "refund";
        const { roomNet, mealNet, creditNoteUsed, other, otherByItem, gst5, gst18, gstOther } = bookingChargesBreakdown(b);
        // Value a cancelled booking actually keeps: cancellation charge
        // retained plus any credit note issued (the CN worth stays with the
        // hotel; the uncollected balance never arrives).
        const retained = isCancelled
          ? (b.cancellationDetails?.cancellationCharge ?? 0) + (b.cancellationDetails?.creditNoteAmount ?? 0)
          : 0;
        // A waive-off writes the unpaid balance out of the booking's value
        // Net of the redeemed credit note — that value was already earned on
        // the booking that issued the note.
        const total = isRefundCancel
          ? retained
          : b.grandTotal - (b.waiveOff?.totalGross ?? 0) - creditNoteUsed;

        // OTA deductions by type (amount + its GST — both withheld)
        let dedCommission = 0, dedTds = 0, dedSpecial = 0;
        (b.deductions ?? []).forEach((d) => {
          const v = d.amount + d.gst;
          if (d.type === "Commission") dedCommission += v;
          else if (d.type === "TDS") dedTds += v;
          else dedSpecial += v;
        });
        const dedTotal = dedCommission + dedTds + dedSpecial;

        let bank = 0, cash = 0, crNote = 0;
        (b.payments ?? []).forEach((p) => {
          const m = (p.mode || "").toLowerCase();
          if (m.includes("cash")) cash += p.amount;
          else if (m.includes("credit note")) crNote += p.amount;
          else bank += p.amount;
        });
        // Legacy bookings may carry an advance without itemized payments
        if (bank + cash + crNote === 0 && b.advance > 0) bank = b.advance;
        // A credit note brings no new money in — it has already been netted
        // off the charges above, so it must not count as a receipt too.
        const received = bank + cash;

        // Recorded refund payouts settle the refund-due balance
        const refundsPaid = isCancelled
          ? (b.cancellationDetails?.refundPayouts ?? []).reduce((s, p) => s + p.amount, 0)
          : 0;

        // Balance convention: positive = pending from guest (amber),
        // negative = refund the hotel owes the guest (purple).
        // Credit-note cancellations keep showing the unpaid balance until it
        // is waived off — the waive-off reduces `total` to what was received,
        // which drives this to 0. Refund cancellations show only the unpaid
        // refund as negative until Record Refund clears it.
        // Balance settles against net of OTA deductions — the deducted part
        // never arrives, so it must not read as pending.
        let bal: number;
        if (!isCancelled) bal = Math.round(total - dedTotal - received);
        else if (isRefundCancel) bal = Math.min(0, Math.round(retained + refundsPaid - received));
        else bal = Math.max(0, Math.round(total - dedTotal - received));
        // Credit-note cancellation still carrying an unpaid balance — the
        // waive-off hasn't been done yet; shown in red so it stands apart
        // from money actually expected from guests.
        const waivePending = isCancelled && !isRefundCancel && bal >= 1;
        return { b, roomNet, mealNet, creditNoteUsed, other, otherByItem, gst5, gst18, gstOther, total, dedCommission, dedTds, dedSpecial, bank, cash, crNote, bal, isCancelled, waivePending };
      });
  }, [bookings, search, rangeFrom, rangeTo]);

  const totals = useMemo(
    () =>
      tableRows.reduce(
        (t, r) => ({
          roomNet: t.roomNet + r.roomNet,
          mealNet: t.mealNet + r.mealNet,
          other: t.other + r.other,
          creditNoteUsed: t.creditNoteUsed + r.creditNoteUsed,
          gst5: t.gst5 + r.gst5,
          gst18: t.gst18 + r.gst18,
          gstOther: t.gstOther + r.gstOther,
          total: t.total + r.total,
          dedCommission: t.dedCommission + r.dedCommission,
          dedTds: t.dedTds + r.dedTds,
          dedSpecial: t.dedSpecial + r.dedSpecial,
          bank: t.bank + r.bank,
          cash: t.cash + r.cash,
          crNote: t.crNote + r.crNote,
          bal: t.bal + r.bal,
        }),
        { roomNet: 0, mealNet: 0, creditNoteUsed: 0, other: 0, gst5: 0, gst18: 0, gstOther: 0, total: 0, dedCommission: 0, dedTds: 0, dedSpecial: 0, bank: 0, cash: 0, crNote: 0, bal: 0 }
      ),
    [tableRows]
  );

  // One column per add-on item that actually carries a charge in this view —
  // a month with no venue bookings gets no Venue column. Master-list order
  // first, then any label the data still uses (renamed or deleted items).
  const addOnCols = useMemo(() => {
    const totalsByItem = new Map<string, number>();
    tableRows.forEach((r) => {
      Object.entries(r.otherByItem).forEach(([label, amt]) => {
        if (amt <= 0) return;
        totalsByItem.set(label, (totalsByItem.get(label) ?? 0) + amt);
      });
    });
    const ordered = addOnCategories
      .filter((c) => c.head === "other")
      .map((c) => c.name)
      .filter((name) => totalsByItem.has(name));
    const rest = [...totalsByItem.keys()]
      .filter((label) => !ordered.includes(label))
      .sort((a, b) => a.localeCompare(b));
    return [...ordered, ...rest].map((label) => ({
      label,
      total: totalsByItem.get(label) ?? 0,
    }));
  }, [tableRows, addOnCategories]);

  // What's left in Other once the itemised add-ons have their own columns:
  // the unnamed legacy remainder.
  const otherResidual = (r: (typeof tableRows)[number]) =>
    Math.max(0, r.other - Object.values(r.otherByItem).reduce((s2, v) => s2 + v, 0));
  const totalsOtherResidual = tableRows.reduce((s2, r) => s2 + otherResidual(r), 0);

  // Pending payments (global, unaffected by filters)
  const pendingBookings = useMemo(
    () => bookings.filter((b) => b.status === "Confirmed" && b.balance >= 1),
    [bookings]
  );
  const pendingPayments = pendingBookings.reduce((s, b) => s + b.balance, 0);

  // Waive-offs pending (global) — credit-note cancellations still carrying
  // an unpaid balance that has to be written off. Mirrors the red balance
  // cells in the table.
  const waivePendingTotals = useMemo(() => {
    let sum = 0;
    let count = 0;
    bookings.forEach((b) => {
      if (b.status !== "Cancelled") return;
      if (b.cancellationDetails?.resolution === "refund") return;
      const total = b.grandTotal - (b.waiveOff?.totalGross ?? 0);
      let received = (b.payments ?? []).reduce((s, p) => s + p.amount, 0);
      if (received === 0 && b.advance > 0) received = b.advance;
      const bal = Math.max(0, Math.round(total - received));
      if (bal >= 1) {
        sum += bal;
        count++;
      }
    });
    return { sum, count };
  }, [bookings]);

  // Refunds due (global, unaffected by filters) — unpaid refund balance on
  // refund-cancelled bookings, same formula as the table's balance column.
  const refundsDue = useMemo(() => {
    let sum = 0;
    bookings.forEach((b) => {
      if (b.status !== "Cancelled" || b.cancellationDetails?.resolution !== "refund") return;
      const retained =
        (b.cancellationDetails?.cancellationCharge ?? 0) +
        (b.cancellationDetails?.creditNoteAmount ?? 0);
      let received = (b.payments ?? []).reduce((s, p) => s + p.amount, 0);
      if (received === 0 && b.advance > 0) received = b.advance;
      const refundsPaid = (b.cancellationDetails?.refundPayouts ?? []).reduce((s, p) => s + p.amount, 0);
      sum += Math.max(0, Math.round(received - retained - refundsPaid));
    });
    return sum;
  }, [bookings]);

  if (currentRole === "Front Office") {
    return (
      <div className="view">
        <div className="pg-hd">
          <div><h2>Access Denied</h2><p>Revenue is not available for your role.</p></div>
        </div>
      </div>
    );
  }

  const rangeLabel = month === "custom"
    ? [dateFrom, dateTo].filter(Boolean).map(fmtShort).join(" – ") || "Custom"
    : monthOptions.find((o) => o.value === effMonth)?.label ?? effMonth;

  const exportExcel = () => {
    const headers = [
      "SL No.", "Check-in", "Check-out", "Guest Name", "Mobile", "Booking ID", "Status",
      "Room Charges", "Meal Charges", ...addOnCols.map((c) => c.label), "Other Charges", "GST 5%", "GST 18%", "Total Charges", "Credit Note Used",
      "Commission", "TDS", "Special Discount",
      "Received - Bank", "Received - Cash", "Balance",
    ];
    const lines = tableRows.map((r, i) => [
      i + 1, fmtShort(r.b.checkin), fmtShort(r.b.checkout), r.b.guest, r.b.mobile, r.b.id, r.b.status,
      Math.round(r.roomNet), Math.round(r.mealNet),
      ...addOnCols.map((c) => Math.round(r.otherByItem[c.label] ?? 0)),
      Math.round(otherResidual(r)),
      Math.round(r.gst5), Math.round(r.gst18), Math.round(r.total), Math.round(r.creditNoteUsed),
      Math.round(r.dedCommission), Math.round(r.dedTds), Math.round(r.dedSpecial),
      Math.round(r.bank), Math.round(r.cash), Math.round(r.bal),
    ]);
    lines.push([
      "", "", "", "", "", "Total", "",
      Math.round(totals.roomNet), Math.round(totals.mealNet),
      ...addOnCols.map((c) => Math.round(c.total)),
      Math.round(totalsOtherResidual),
      Math.round(totals.gst5), Math.round(totals.gst18), Math.round(totals.total), Math.round(totals.creditNoteUsed),
      Math.round(totals.dedCommission), Math.round(totals.dedTds), Math.round(totals.dedSpecial),
      Math.round(totals.bank), Math.round(totals.cash), Math.round(totals.bal),
    ]);
    const csv = [headers, ...lines]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue_${month === "custom" ? "custom-range" : effMonth || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const numTd: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap", fontSize: 12 };
  // Room, Meal, per-item add-ons, Other, GST 5%, GST 18%, Total, Cr Note used
  const chargesCols = 7 + addOnCols.length;
  // booking info + charges + deductions + payments + bal + actions
  const allCols = 5 + chargesCols + 3 + 2 + 2;

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Revenue Register</h2>
        </div>
        <div className="pg-hd-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            value={month === "custom" ? "custom" : effMonth}
            onChange={(e) => {
              const v = e.target.value;
              setMonth(v);
              if (v !== "custom") { setDateFrom(""); setDateTo(""); }
            }}
            style={{ height: 32, padding: "0 10px", fontSize: 13, border: "1px solid var(--bd)", borderRadius: "var(--r2)", background: "var(--surf)", color: "var(--t1)", cursor: "pointer" }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
            <option value="custom">Custom Range</option>
          </select>
          {month === "custom" && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ height: 32, padding: "0 8px", fontSize: 12, border: "1px solid var(--bd)", borderRadius: "var(--r2)", background: "var(--surf)", color: "var(--t1)", outline: "none" }}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ height: 32, padding: "0 8px", fontSize: 12, border: "1px solid var(--bd)", borderRadius: "var(--r2)", background: "var(--surf)", color: "var(--t1)", outline: "none" }}
              />
            </>
          )}
          <input
            type="search"
            placeholder="Search booking ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 160, height: 32, padding: "0 10px", border: "1px solid var(--bd)", borderRadius: "var(--r2)", fontSize: 13, background: "var(--surf)", outline: "none" }}
          />
          <button className="btn btn-primary btn-sm" onClick={exportExcel} disabled={tableRows.length === 0}>
            Export to Excel
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 18 }}>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Total Charges ({rangeLabel})
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--sb)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(totals.roomNet + totals.mealNet + totals.other)}
          </div>
          <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Excluding GST</div>
        </div>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Received ({rangeLabel})
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--grn)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(totals.bank + totals.cash)}
          </div>
        </div>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Pending Payments (Overall)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--amb)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(pendingPayments)}
          </div>
        </div>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Refunds Due (Overall)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: refundsDue > 0 ? "var(--pur)" : "var(--t2)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(refundsDue)}
          </div>
        </div>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Waive-off Pending (Overall)
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: waivePendingTotals.sum > 0 ? "var(--red)" : "var(--t2)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(waivePendingTotals.sum)}
          </div>
          <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
            {waivePendingTotals.count === 0
              ? "Nothing to settle"
              : `${waivePendingTotals.count} booking${waivePendingTotals.count === 1 ? "" : "s"} to settle`}
          </div>
        </div>
      </div>

      {/* Revenue Table */}
      <div className="tbl-wrap">
        <div className="tbl-hd">
          <h3>Revenue Table</h3>
          <span style={{ fontSize: 12, color: "var(--t3)", marginLeft: 12 }}>
            {tableRows.length} booking{tableRows.length !== 1 ? "s" : ""}
          </span>
          <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
            <strong style={{ color: "var(--amb)" }}>Amount pending from guest</strong>
            <strong style={{ color: "var(--pur)" }}>Refund due to guest</strong>
            <strong style={{ color: "var(--red)" }}>Waive-off pending</strong>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 1520 }}>
            <thead>
              <tr>
                <th colSpan={5} style={groupHdStyle}>Booking Info</th>
                <th colSpan={chargesCols} style={{ ...groupHdStyle, ...sectionBorder }}>Charges</th>
                <th colSpan={3} style={{ ...groupHdStyle, ...sectionBorder }}>Deductions</th>
                <th colSpan={2} style={{ ...groupHdStyle, ...sectionBorder }}>Payments Received</th>
                <th style={{ ...groupHdStyle, ...sectionBorder, textAlign: "right" }}>Bal</th>
                <th style={{ ...groupHdStyle, ...sectionBorder }}></th>
              </tr>
              <tr>
                <th style={{ width: 36 }}>SL</th>
                <th style={{ whiteSpace: "nowrap" }}>C-in</th>
                <th style={{ whiteSpace: "nowrap" }}>C-out</th>
                <th>Guest</th>
                <th style={{ whiteSpace: "nowrap" }}>Bkg ID</th>
                <th style={{ textAlign: "right", ...sectionBorder }}>Room</th>
                <th style={{ textAlign: "right" }}>Meal</th>
                {addOnCols.map((c) => (
                  <th key={c.label} style={{ textAlign: "right", whiteSpace: "nowrap" }}>{c.label}</th>
                ))}
                <th style={{ textAlign: "right" }}>Other</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>GST 5%</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>GST 18%</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }} title="Credit note redeemed against this booking — already netted off the charges">
                  Cr Note
                </th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap", ...sectionBorder }}>Commission</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>TDS</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Spl Disc</th>
                <th style={{ textAlign: "right", ...sectionBorder }}>Bank</th>
                <th style={{ textAlign: "right" }}>Cash</th>
                <th style={{ textAlign: "right", ...sectionBorder }}>₹</th>
                <th style={{ textAlign: "center", width: 60, ...sectionBorder }}></th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={allCols}>
                    <div className="empty-state" style={{ padding: 32 }}>
                      <p>No confirmed or cancelled bookings in this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {tableRows.map((r, i) => (
                    <tr key={r.b.id}>
                      <td style={{ color: "var(--t3)", fontSize: 12 }}>{i + 1}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtShort(r.b.checkin)}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtShort(r.b.checkout)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 500, color: "var(--t1)", fontSize: 12 }}>{r.b.guest}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)" }}>{r.b.mobile || "—"}</div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Link
                          href={`/bookings/${r.b.id}`}
                          style={{ fontSize: 11, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--acc)", fontWeight: 700, textDecoration: "none" }}
                        >
                          {r.b.id}
                        </Link>
                        {r.isCancelled && (
                          <span className="badge bd-lost" style={{ marginLeft: 5, fontSize: 8 }}>Cancelled</span>
                        )}
                      </td>
                      <td style={{ ...numTd, ...sectionBorder }}>{nfmt(r.roomNet)}</td>
                      <td style={numTd}>{nfmt(r.mealNet)}</td>
                      {addOnCols.map((c) => (
                        <td key={c.label} style={numTd}>{nfmt(r.otherByItem[c.label] ?? 0)}</td>
                      ))}
                      <td style={numTd}>{nfmt(otherResidual(r))}</td>
                      <td style={{ ...numTd, color: "var(--t3)" }}>{nfmt(r.gst5)}</td>
                      <td style={{ ...numTd, color: "var(--t3)" }}>{nfmt(r.gst18)}</td>
                      <td style={{ ...numTd, fontWeight: 700 }}>{nfmt(r.total)}</td>
                      <td style={{ ...numTd, color: r.creditNoteUsed > 0 ? "var(--pur)" : "var(--t3)" }}>
                        {r.creditNoteUsed > 0 ? `−${nfmt(r.creditNoteUsed)}` : "0"}
                      </td>
                      <td style={{ ...numTd, ...sectionBorder, color: r.dedCommission > 0 ? "var(--red)" : "var(--t3)" }}>
                        {r.dedCommission > 0 ? `−${nfmt(r.dedCommission)}` : "0"}
                      </td>
                      <td style={{ ...numTd, color: r.dedTds > 0 ? "var(--red)" : "var(--t3)" }}>
                        {r.dedTds > 0 ? `−${nfmt(r.dedTds)}` : "0"}
                      </td>
                      <td style={{ ...numTd, color: r.dedSpecial > 0 ? "var(--red)" : "var(--t3)" }}>
                        {r.dedSpecial > 0 ? `−${nfmt(r.dedSpecial)}` : "0"}
                      </td>
                      <td style={{ ...numTd, ...sectionBorder }}>{nfmt(r.bank)}</td>
                      <td style={numTd}>{nfmt(r.cash)}</td>
                      <td
                        style={{
                          ...numTd,
                          ...sectionBorder,
                          fontWeight: 700,
                          background: r.waivePending
                            ? "var(--red-lt)"
                            : r.bal > 0 ? "var(--amb-lt)" : r.bal < 0 ? "var(--pur-lt)" : undefined,
                          color: r.waivePending
                            ? "var(--red)"
                            : r.bal > 0 ? "var(--amb)" : r.bal < 0 ? "var(--pur)" : "var(--grn)",
                        }}
                        title={
                          r.bal > 0
                            ? r.isCancelled
                              ? "Unpaid balance — waive off pending"
                              : "Amount pending from guest"
                            : r.bal < 0
                            ? "Refund due to guest"
                            : "Settled"
                        }
                      >
                        {r.bal === 0 ? "0" : r.bal > 0 ? nfmt(r.bal) : `−${nfmt(-r.bal)}`}
                      </td>
                      <td style={{ textAlign: "center", ...sectionBorder }}>
                        <Link href={`/bookings/${r.b.id}`} className="btn btn-ghost btn-xs">View</Link>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                    <td colSpan={5} style={{ textAlign: "right", fontSize: 12, color: "var(--t2)" }}>Total</td>
                    <td style={{ ...numTd, ...sectionBorder, fontWeight: 700 }}>{nfmt(totals.roomNet)}</td>
                    <td style={{ ...numTd, fontWeight: 700 }}>{nfmt(totals.mealNet)}</td>
                    {addOnCols.map((c) => (
                      <td key={c.label} style={{ ...numTd, fontWeight: 700 }}>{nfmt(c.total)}</td>
                    ))}
                    <td style={{ ...numTd, fontWeight: 700 }}>{nfmt(totalsOtherResidual)}</td>
                    <td style={{ ...numTd, fontWeight: 700, color: "var(--t3)" }}>{nfmt(totals.gst5)}</td>
                    <td style={{ ...numTd, fontWeight: 700, color: "var(--t3)" }}>{nfmt(totals.gst18)}</td>
                    <td style={{ ...numTd, fontWeight: 800 }}>{nfmt(totals.total)}</td>
                    <td style={{ ...numTd, fontWeight: 700, color: totals.creditNoteUsed > 0 ? "var(--pur)" : "var(--t3)" }}>
                      {totals.creditNoteUsed > 0 ? `−${nfmt(totals.creditNoteUsed)}` : "0"}
                    </td>
                    <td style={{ ...numTd, ...sectionBorder, fontWeight: 700, color: totals.dedCommission > 0 ? "var(--red)" : "var(--t3)" }}>
                      {totals.dedCommission > 0 ? `−${nfmt(totals.dedCommission)}` : "0"}
                    </td>
                    <td style={{ ...numTd, fontWeight: 700, color: totals.dedTds > 0 ? "var(--red)" : "var(--t3)" }}>
                      {totals.dedTds > 0 ? `−${nfmt(totals.dedTds)}` : "0"}
                    </td>
                    <td style={{ ...numTd, fontWeight: 700, color: totals.dedSpecial > 0 ? "var(--red)" : "var(--t3)" }}>
                      {totals.dedSpecial > 0 ? `−${nfmt(totals.dedSpecial)}` : "0"}
                    </td>
                    <td style={{ ...numTd, ...sectionBorder, fontWeight: 700 }}>{nfmt(totals.bank)}</td>
                    <td style={{ ...numTd, fontWeight: 700 }}>{nfmt(totals.cash)}</td>
                    <td style={{ ...numTd, ...sectionBorder, fontWeight: 800, color: totals.bal > 0 ? "var(--amb)" : totals.bal < 0 ? "var(--pur)" : "var(--grn)" }}>
                      {totals.bal === 0 ? "0" : totals.bal > 0 ? nfmt(totals.bal) : `−${nfmt(-totals.bal)}`}
                    </td>
                    <td style={sectionBorder}></td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
