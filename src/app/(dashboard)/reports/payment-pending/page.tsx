"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ReportFilters } from "@/components/ReportFilters";
import { EmptyRow, ReportShell } from "@/components/ReportShell";
import { fmt, fmtIN, todayStr } from "@/lib/utils";
import { b2bSegment, b2cSegment, csvName, downloadCsv, emptyFilter, inRange, matchesSegment, stayNights } from "@/lib/reports";

// Money still owed on committed stays: Confirmed and Completed B2C bookings
// and Confirmed B2B bookings with a balance. Same rule as the Revenue
// Register's Pending Payments card.
export default function PaymentPendingReport() {
  const { bookings, b2bBookings } = useApp();
  const [today] = useState(() => todayStr());
  const [filter, setFilter] = useState(() => emptyFilter());

  const rows = useMemo(() => {
    const out: {
      id: string; name: string; contact: string; segment: string; checkin: string; checkout: string; nights: number;
      bill: number; received: number; balance: number; status: string; by: string; href: string;
    }[] = [];
    bookings.forEach((b) => {
      if ((b.status !== "Confirmed" && b.status !== "Completed") || b.balance < 1) return;
      const seg = b2cSegment(b);
      if (!matchesSegment(filter, seg) || !inRange(filter, b.checkin)) return;
      out.push({ id: b.id, name: b.guest, contact: b.mobile, segment: seg.label, checkin: b.checkin, checkout: b.checkout, nights: stayNights(b.checkin, b.checkout), bill: b.grandTotal, received: b.advance, balance: b.balance, status: b.status, by: b.rex, href: `/bookings/${b.id}` });
    });
    b2bBookings.forEach((b) => {
      if (b.status !== "Confirmed" || b.balance < 1) return;
      const seg = b2bSegment(b);
      if (!matchesSegment(filter, seg) || !inRange(filter, b.checkin)) return;
      out.push({ id: b.id, name: b.orgName, contact: b.contactNumber, segment: seg.label, checkin: b.checkin, checkout: b.checkout, nights: stayNights(b.checkin, b.checkout), bill: b.grandTotal, received: b.advance, balance: b.balance, status: b.status, by: b.createdBy, href: `/b2b/${b.id}` });
    });
    return out.sort((a, b) => a.checkin.localeCompare(b.checkin));
  }, [bookings, b2bBookings, filter]);

  const totals = rows.reduce((t, r) => ({ bill: t.bill + r.bill, received: t.received + r.received, balance: t.balance + r.balance }), { bill: 0, received: 0, balance: 0 });

  const exportCsv = () =>
    downloadCsv(
      csvName("payment_pending", filter),
      ["Booking ID", "Guest / Organisation", "Contact", "Segment", "Check-in", "Check-out", "Nights", "Bill", "Received", "Balance", "Status", "Handled by"],
      [
        ...rows.map((r) => [r.id, r.name, r.contact, r.segment, fmtIN(r.checkin), fmtIN(r.checkout), r.nights, Math.round(r.bill), Math.round(r.received), Math.round(r.balance), r.status, r.by]),
        ["Total", "", "", "", "", "", "", Math.round(totals.bill), Math.round(totals.received), Math.round(totals.balance), "", ""],
      ]
    );

  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  return (
    <ReportShell
      title="Payment Pending"
      subtitle="Confirmed and completed stays still owing money. Date range applies to check-in."
      group="finance"
      summary={<><span><b>{rows.length}</b> bookings</span><span>Pending <b style={{ color: "var(--amb)" }}>{fmt(totals.balance)}</b></span></>}
      filters={<ReportFilters filter={filter} onChange={setFilter} today={today} dateLabel="Check-in" onExport={exportCsv} exportDisabled={rows.length === 0} />}
    >
      <table style={{ minWidth: 1100 }}>
        <thead>
          <tr>
            <th>Booking ID</th><th>Guest / Organisation</th><th>Segment</th><th>Check-in</th><th>Check-out</th>
            <th style={num}>Nights</th><th style={num}>Bill</th><th style={num}>Received</th><th style={num}>Balance</th><th>Status</th><th>Handled by</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={12} text="Nothing pending in this range" /> : (
            <>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.id}</td>
                  <td><div style={{ fontWeight: 500 }}>{r.name}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{r.contact}</div></td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.segment}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkin)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkout)}</td>
                  <td style={num}>{r.nights || "Dayout"}</td>
                  <td style={num}>{fmt(r.bill)}</td>
                  <td style={{ ...num, color: "var(--grn)" }}>{fmt(r.received)}</td>
                  <td style={{ ...num, fontWeight: 700, color: "var(--amb)" }}>{fmt(r.balance)}</td>
                  <td style={{ fontSize: 11 }}>{r.status}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{r.by}</td>
                  <td><Link href={r.href} className="btn btn-ghost btn-xs">View</Link></td>
                </tr>
              ))}
              <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                <td colSpan={6} style={{ textAlign: "right", fontSize: 12, color: "var(--t2)" }}>Total</td>
                <td style={num}>{fmt(totals.bill)}</td>
                <td style={{ ...num, color: "var(--grn)" }}>{fmt(totals.received)}</td>
                <td style={{ ...num, color: "var(--amb)" }}>{fmt(totals.balance)}</td>
                <td colSpan={3}></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </ReportShell>
  );
}
