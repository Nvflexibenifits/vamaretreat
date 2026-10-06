"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ReportFilters } from "@/components/ReportFilters";
import { EmptyRow, ReportShell } from "@/components/ReportShell";
import { fmt, fmtIN, todayStr } from "@/lib/utils";
import { b2bSegment, b2cSegment, csvName, downloadCsv, emptyFilter, inRange, matchesSegment } from "@/lib/reports";

type Receipt = {
  key: string; date: string; time: string; id: string; name: string; segment: string; type: string; mode: string;
  amount: number; tds: number; by: string; note: string; href: string;
};

// Every receipt recorded on any booking, by payment date. Refunds show as
// negative rows, TDS beside the amount, and the foot totals by mode so the
// day's bank and cash can be reconciled.
export default function PaymentsReceivedReport() {
  const { bookings, b2bBookings } = useApp();
  const [today] = useState(() => todayStr());
  const [filter, setFilter] = useState(() => emptyFilter(todayStr(), todayStr()));
  const [mode, setMode] = useState("");

  const all = useMemo(() => {
    const out: Receipt[] = [];
    bookings.forEach((b) => {
      const seg = b2cSegment(b);
      (b.payments ?? []).forEach((p, i) =>
        out.push({ key: `${b.id}-${i}`, date: p.date, time: p.time, id: b.id, name: b.guest, segment: seg.label, type: p.type, mode: p.mode || "Bank Transfer", amount: p.amount, tds: p.tds ?? 0, by: p.by, note: [p.creditNoteCode, p.reference].filter(Boolean).join(" · "), href: `/bookings/${b.id}` })
      );
    });
    b2bBookings.forEach((b) => {
      const seg = b2bSegment(b);
      (b.payments ?? []).forEach((p, i) =>
        out.push({ key: `${b.id}-${i}`, date: p.date, time: p.time, id: b.id, name: b.orgName, segment: seg.label, type: p.type, mode: p.mode || "Bank Transfer", amount: p.amount, tds: p.tds ?? 0, by: p.by, note: p.reference ?? "", href: `/b2b/${b.id}` })
      );
    });
    return out;
  }, [bookings, b2bBookings]);

  const modes = useMemo(() => [...new Set(all.map((r) => r.mode))].sort(), [all]);

  const rows = useMemo(
    () =>
      all
        .filter((r) => inRange(filter, r.date))
        .filter((r) => {
          const b = bookings.find((x) => x.id === r.id);
          const seg = b ? b2cSegment(b) : b2bSegment(b2bBookings.find((x) => x.id === r.id)!);
          return matchesSegment(filter, seg);
        })
        .filter((r) => !mode || r.mode === mode)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [all, filter, mode, bookings, b2bBookings]
  );

  const byMode = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.mode, (m.get(r.mode) ?? 0) + r.amount));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const tdsTotal = rows.reduce((s, r) => s + r.tds, 0);

  const exportCsv = () =>
    downloadCsv(
      csvName("payments_received", filter),
      ["Date", "Time", "Booking ID", "Guest / Organisation", "Segment", "Type", "Mode", "Amount", "TDS", "Recorded by", "Note"],
      [
        ...rows.map((r) => [fmtIN(r.date), r.time, r.id, r.name, r.segment, r.type, r.mode, Math.round(r.amount), Math.round(r.tds), r.by, r.note]),
        ...byMode.map(([m, v]) => ["Total", "", "", "", "", "", m, Math.round(v), "", "", ""]),
        ["Total", "", "", "", "", "", "All modes", Math.round(total), Math.round(tdsTotal), "", ""],
      ]
    );

  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  const ctl: React.CSSProperties = { height: 32, padding: "0 10px", fontSize: 13, border: "1px solid var(--bd)", borderRadius: "var(--r2)", background: "var(--surf)", color: "var(--t1)" };
  return (
    <ReportShell
      title="Payments Received"
      subtitle="Every receipt by payment date. Refunds show as negative amounts. TDS is settlement, not cash."
      group="finance"
      summary={<><span><b>{rows.length}</b> receipts</span><span>Received <b style={{ color: "var(--grn)" }}>{fmt(total)}</b></span>{tdsTotal > 0 && <span>TDS <b>{fmt(tdsTotal)}</b></span>}</>}
      filters={
        <ReportFilters
          filter={filter}
          onChange={setFilter}
          today={today}
          dateLabel="Paid"
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
      <table style={{ minWidth: 1100 }}>
        <thead>
          <tr>
            <th>Date</th><th>Time</th><th>Booking ID</th><th>Guest / Organisation</th><th>Segment</th><th>Type</th><th>Mode</th>
            <th style={num}>Amount</th><th style={num}>TDS</th><th>Recorded by</th><th>Note</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={12} text="No receipts in this range" /> : (
            <>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.date)}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.time}</td>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.id}</td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.segment}</td>
                  <td style={{ fontSize: 11 }}>{r.type}</td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.mode}</td>
                  <td style={{ ...num, fontWeight: 600, color: r.amount < 0 ? "var(--pur)" : "var(--t1)" }}>{r.amount < 0 ? `−${fmt(-r.amount)}` : fmt(r.amount)}</td>
                  <td style={{ ...num, color: "var(--t3)" }}>{r.tds > 0 ? fmt(r.tds) : "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{r.by}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{r.note || ""}</td>
                  <td><Link href={r.href} className="btn btn-ghost btn-xs">View</Link></td>
                </tr>
              ))}
              {byMode.map(([m, v]) => (
                <tr key={m} style={{ background: "var(--surf2)" }}>
                  <td colSpan={6} style={{ textAlign: "right", fontSize: 12, color: "var(--t2)" }}>Total by mode</td>
                  <td style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{m}</td>
                  <td style={{ ...num, fontWeight: 700 }}>{v < 0 ? `−${fmt(-v)}` : fmt(v)}</td>
                  <td colSpan={4}></td>
                </tr>
              ))}
              <tr style={{ background: "var(--surf2)", fontWeight: 800 }}>
                <td colSpan={7} style={{ textAlign: "right", fontSize: 12, color: "var(--t1)" }}>Total received</td>
                <td style={{ ...num, color: "var(--grn)" }}>{fmt(total)}</td>
                <td style={num}>{tdsTotal > 0 ? fmt(tdsTotal) : ""}</td>
                <td colSpan={3}></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </ReportShell>
  );
}
