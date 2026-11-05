"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ReportFilters } from "@/components/ReportFilters";
import { EmptyRow, ReportShell } from "@/components/ReportShell";
import { SummaryCard, SummaryCards } from "@/components/SummaryCard";
import { fmt, fmtIN, isDepositAppliedPayment, otaReceiptSide, todayStr } from "@/lib/utils";
import { b2bSegment, b2cSegment, csvName, downloadCsv, emptyFilter, inRange, matchesSegment, type SegmentInfo } from "@/lib/reports";
import { DEPOSIT_MODE } from "@/types";

type Receipt = {
  key: string; date: string; time: string; id: string; name: string; seg: SegmentInfo; note: string; mode: string;
  amount: number; tds: number; href: string;
};

// Every receipt recorded on any booking, by payment date, with the mode it
// came in by so the bank and cash can be reconciled. Refunds show as
// negative rows and TDS beside the amount. Security deposits on group
// bookings are listed too: the money came in (or went back) through the
// bank, even though it is never sales. A deposit applied to the bill carries
// the "Security Deposit" mode, so it never doubles up the total. On an OTA
// booking a receipt for an add-on was paid to the hotel, so it reports as
// Direct; the OTA's payout stays OTA.
export default function PaymentsReceivedReport() {
  const { bookings, b2bBookings } = useApp();
  const [today] = useState(() => todayStr());
  const [filter, setFilter] = useState(() => emptyFilter(todayStr(), todayStr()));
  const [mode, setMode] = useState("");

  const all = useMemo(() => {
    const out: Receipt[] = [];
    const direct: SegmentInfo = { segment: "b2c-direct", sub: "", label: "B2C · Direct" };
    bookings.forEach((b) => {
      const seg = b2cSegment(b);
      const href = `/bookings/${b.id}`;
      (b.payments ?? []).forEach((p, i) => {
        const addOn = b.source === "OTA" && otaReceiptSide(b, p) === "direct";
        const note = isDepositAppliedPayment(p)
          ? "Deposit applied to the bill"
          : p.type === "Refund" || p.amount < 0
          ? "Refund"
          : addOn
          ? "Add-on, paid to the hotel"
          : "";
        out.push({ key: `${b.id}-${i}`, date: p.date, time: p.time, id: b.id, name: b.guest, seg: addOn ? direct : seg, note, mode: p.mode || "Bank Transfer", amount: p.amount, tds: p.tds ?? 0, href });
      });
      (b.deposit?.entries ?? []).forEach((d) =>
        out.push({ key: `${b.id}-dep-${d.id}`, date: d.date, time: "", id: b.id, name: b.guest, seg, note: "Security deposit, held apart from the bill", mode: d.mode, amount: d.amount, tds: 0, href })
      );
      const st = b.deposit?.settlement;
      if (st && st.refunded > 0) {
        out.push({ key: `${b.id}-dep-refund`, date: st.date, time: "", id: b.id, name: b.guest, seg, note: "Deposit refund", mode: st.refundMode, amount: -st.refunded, tds: 0, href });
      }
    });
    b2bBookings.forEach((b) => {
      const seg = b2bSegment(b);
      (b.payments ?? []).forEach((p, i) =>
        out.push({ key: `${b.id}-${i}`, date: p.date, time: p.time, id: b.id, name: b.orgName, seg, note: p.amount < 0 ? "Refund" : "", mode: p.mode || "Bank Transfer", amount: p.amount, tds: p.tds ?? 0, href: `/b2b/${b.id}` })
      );
    });
    return out;
  }, [bookings, b2bBookings]);

  const modes = useMemo(() => [...new Set(all.map((r) => r.mode))].sort(), [all]);

  const rows = useMemo(
    () =>
      all
        .filter((r) => inRange(filter, r.date) && matchesSegment(filter, r.seg) && (!mode || r.mode === mode))
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id.localeCompare(b.id)),
    [all, filter, mode]
  );

  // A deposit applied to the bill is a settlement, not money arriving, so
  // it stays out of the received total.
  const total = rows.filter((r) => r.mode !== DEPOSIT_MODE).reduce((s, r) => s + r.amount, 0);
  const tdsTotal = rows.reduce((s, r) => s + r.tds, 0);
  const rangeLabel =
    filter.from && filter.to && filter.from === filter.to
      ? (filter.from === today ? "today" : fmtIN(filter.from))
      : filter.from || filter.to
      ? `${filter.from ? fmtIN(filter.from) : "start"} to ${filter.to ? fmtIN(filter.to) : "today"}`
      : "all time";

  const exportCsv = () =>
    downloadCsv(
      csvName("payments_received", filter),
      ["Date", "Booking ID", "Guest / Organisation", "Segment", "Note", "Mode", "Amount", "TDS"],
      [
        ...rows.map((r) => [fmtIN(r.date), r.id, r.name, r.seg.label, r.note, r.mode, Math.round(r.amount), Math.round(r.tds)]),
        ["Total", "", "", "", "", "", Math.round(total), Math.round(tdsTotal)],
      ]
    );

  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  const ctl: React.CSSProperties = { height: 32, padding: "0 10px", fontSize: 13, border: "1px solid var(--bd)", borderRadius: "var(--r2)", background: "var(--surf)", color: "var(--t1)" };
  return (
    <ReportShell
      title="Payments Received"
      subtitle="Every receipt by payment date, with the mode it came in by. Refunds show as negative amounts. TDS is settlement, not cash."
      group="finance"
      summary={<><span><b>{rows.length}</b> receipts</span></>}
      cards={
        <SummaryCards>
          <SummaryCard label={`Received (${rangeLabel})`} value={fmt(total)} color="var(--grn)" note={mode ? `${mode} only` : "All modes"} />
          {tdsTotal > 0 && <SummaryCard label={`TDS (${rangeLabel})`} value={fmt(tdsTotal)} color="var(--t2)" note="Withheld by the payer, settles the bill" />}
        </SummaryCards>
      }
      filters={
        <ReportFilters
          filter={filter}
          onChange={setFilter}
          today={today}
          dateLabel="Paid"
          month={false}
          todayButton
          onExport={exportCsv}
          exportDisabled={rows.length === 0}
          extra={
            <label className="report-filter">
              <span>Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={ctl}>
                <option value="">All modes</option>
                {modes.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          }
        />
      }
    >
      <table style={{ minWidth: 820 }}>
        <thead>
          <tr>
            <th>Date</th><th>Booking ID</th><th>Guest / Organisation</th><th>Segment</th><th>Mode</th>
            <th style={num}>Amount</th><th style={num}>TDS</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={8} text="No receipts in this range" /> : (
            <>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.date)}</td>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.id}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    {r.note && <div style={{ fontSize: 11, color: "var(--t3)" }}>{r.note}</div>}
                  </td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.seg.label}</td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.mode}</td>
                  <td style={{ ...num, fontWeight: 600, color: r.amount < 0 ? "var(--pur)" : "var(--t1)" }}>{r.amount < 0 ? `−${fmt(-r.amount)}` : fmt(r.amount)}</td>
                  <td style={{ ...num, color: "var(--t3)" }}>{r.tds > 0 ? fmt(r.tds) : "—"}</td>
                  <td><Link href={r.href} className="btn btn-ghost btn-xs">View</Link></td>
                </tr>
              ))}
              <tr style={{ background: "var(--surf2)", fontWeight: 800 }}>
                <td colSpan={5} style={{ textAlign: "right", fontSize: 12, color: "var(--t1)" }}>Total received</td>
                <td style={{ ...num, color: "var(--grn)" }}>{fmt(total)}</td>
                <td style={num}>{tdsTotal > 0 ? fmt(tdsTotal) : ""}</td>
                <td></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </ReportShell>
  );
}
