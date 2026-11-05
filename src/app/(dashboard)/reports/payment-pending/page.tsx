"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ReportFilters } from "@/components/ReportFilters";
import { EmptyRow, ReportShell } from "@/components/ReportShell";
import { SummaryCard, SummaryCards } from "@/components/SummaryCard";
import { fmt, fmtIN, otaSplit, todayStr } from "@/lib/utils";
import { b2bSegment, b2cSegment, downloadCsv, emptyFilter, matchesSegment, type SegmentInfo } from "@/lib/reports";

type Row = {
  key: string; id: string; name: string; contact: string; seg: SegmentInfo; note: string;
  checkin: string; checkout: string; bill: number; received: number; balance: number; href: string;
};

// Money owed on committed stays as of today: confirmed (and since completed)
// B2C bookings and confirmed B2B bookings that checked in on or before today
// and still carry a balance. Tentative is never sales, so it is never
// pending, and nothing here depends on a date range. An OTA booking with
// add-ons splits in two: what the OTA still owes for the room, and what the
// guest still owes the hotel for the add-ons.
export default function PaymentPendingReport() {
  const { bookings, b2bBookings } = useApp();
  const [today] = useState(() => todayStr());
  const [filter, setFilter] = useState(() => emptyFilter());

  const all = useMemo(() => {
    const out: Row[] = [];
    bookings.forEach((b) => {
      if ((b.status !== "Confirmed" && b.status !== "Completed") || b.checkin > today) return;
      const base = { id: b.id, name: b.guest, contact: b.mobile, checkin: b.checkin, checkout: b.checkout, href: `/bookings/${b.id}` };
      const seg = b2cSegment(b);
      const split = otaSplit(b);
      if (split) {
        if (split.ota.bal >= 1) {
          out.push({ ...base, key: `${b.id}-ota`, seg, note: "Room, due from the OTA", bill: b.grandTotal - split.addOnNet - split.addOnGst, received: split.ota.bank + split.ota.cash, balance: split.ota.bal });
        }
        if (split.direct.bal >= 1) {
          out.push({ ...base, key: `${b.id}-direct`, seg: { segment: "b2c-direct", sub: "", label: "B2C · Direct" }, note: "Add-ons, due from the guest", bill: split.direct.payable, received: split.direct.bank + split.direct.cash, balance: split.direct.bal });
        }
        return;
      }
      if (b.balance < 1) return;
      out.push({ ...base, key: b.id, seg, note: "", bill: b.grandTotal, received: b.advance, balance: b.balance });
    });
    b2bBookings.forEach((b) => {
      if (b.status !== "Confirmed" || b.balance < 1 || b.checkin > today) return;
      out.push({
        key: b.id, id: b.id, name: b.orgName, contact: b.contactNumber, seg: b2bSegment(b), note: "", checkin: b.checkin, checkout: b.checkout,
        bill: b.grandTotal, received: b.advance, balance: b.balance, href: `/b2b/${b.id}`,
      });
    });
    return out.sort((a, b) => a.checkin.localeCompare(b.checkin) || a.id.localeCompare(b.id));
  }, [bookings, b2bBookings, today]);

  const rows = useMemo(() => all.filter((r) => matchesSegment(filter, r.seg)), [all, filter]);
  const grand = all.reduce((s, r) => s + r.balance, 0);
  const totals = rows.reduce((t, r) => ({ bill: t.bill + r.bill, received: t.received + r.received, balance: t.balance + r.balance }), { bill: 0, received: 0, balance: 0 });

  const exportCsv = () =>
    downloadCsv(
      `payment_pending_till_${today}${filter.segment === "all" ? "" : `_${filter.segment}${filter.sub ? `-${filter.sub}` : ""}`}.csv`,
      ["Booking ID", "Guest / Organisation", "Contact", "Segment", "Note", "Check-in", "Check-out", "Bill", "Received", "Balance"],
      [
        ...rows.map((r) => [r.id, r.name, r.contact, r.seg.label, r.note, fmtIN(r.checkin), fmtIN(r.checkout), Math.round(r.bill), Math.round(r.received), Math.round(r.balance)]),
        ["Total", "", "", "", "", "", "", Math.round(totals.bill), Math.round(totals.received), Math.round(totals.balance)],
      ]
    );

  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  return (
    <ReportShell
      title="Payment Pending"
      subtitle={`Till today: every confirmed stay checked in on or before ${fmtIN(today)} that still owes money, past stays included.`}
      group="finance"
      summary={<><span><b>{rows.length}</b> pending</span><span>In view <b style={{ color: "var(--amb)" }}>{fmt(totals.balance)}</b></span></>}
      cards={
        <SummaryCards>
          <SummaryCard label="Pending till today" value={fmt(grand)} color="var(--amb)" note={`${all.length} booking${all.length === 1 ? "" : "s"}, all segments`} />
        </SummaryCards>
      }
      filters={<ReportFilters filter={filter} onChange={setFilter} today={today} dateLabel="Check-in" month={false} dates={false} onExport={exportCsv} exportDisabled={rows.length === 0} />}
    >
      <table style={{ minWidth: 900 }}>
        <thead>
          <tr>
            <th>Booking ID</th><th>Guest / Organisation</th><th>Segment</th><th>Check-in</th><th>Check-out</th>
            <th style={num}>Bill</th><th style={num}>Received</th><th style={num}>Balance</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={9} text="Nothing pending" /> : (
            <>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.id}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>{[r.contact, r.note].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.seg.label}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkin)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.checkout === r.checkin ? "Dayout" : fmtIN(r.checkout)}</td>
                  <td style={num}>{fmt(r.bill)}</td>
                  <td style={{ ...num, color: "var(--grn)" }}>{fmt(r.received)}</td>
                  <td style={{ ...num, fontWeight: 700, color: "var(--amb)" }}>{fmt(r.balance)}</td>
                  <td><Link href={r.href} className="btn btn-ghost btn-xs">View</Link></td>
                </tr>
              ))}
              <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                <td colSpan={5} style={{ textAlign: "right", fontSize: 12, color: "var(--t2)" }}>Total</td>
                <td style={num}>{fmt(totals.bill)}</td>
                <td style={{ ...num, color: "var(--grn)" }}>{fmt(totals.received)}</td>
                <td style={{ ...num, color: "var(--amb)" }}>{fmt(totals.balance)}</td>
                <td></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </ReportShell>
  );
}
