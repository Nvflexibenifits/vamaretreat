"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ReportFilters } from "@/components/ReportFilters";
import { EmptyRow, ReportShell } from "@/components/ReportShell";
import { compareRoomLabels, fmt, fmtIN, todayStr } from "@/lib/utils";
import { b2bSegment, b2cSegment, csvName, downloadCsv, emptyFilter, inRange, matchesSegment, stayNights } from "@/lib/reports";

type Row = {
  id: string; name: string; contact: string; segment: string; checkin: string; checkout: string; nights: number;
  villas: string; pax: string; bill: number; received: number; balance: number; status: string; by: string; created: string; href: string;
};

// Committed business: Confirmed and Completed B2C bookings and Confirmed
// B2B bookings, with villas, pax and money.
export default function BookingsReport() {
  const { bookings, b2bBookings } = useApp();
  const [today] = useState(() => todayStr());
  const [filter, setFilter] = useState(() => emptyFilter());
  const [status, setStatus] = useState<"all" | "Confirmed" | "Completed">("all");

  const rows = useMemo(() => {
    const out: Row[] = [];
    bookings.forEach((b) => {
      if (b.status !== "Confirmed" && b.status !== "Completed") return;
      if (status !== "all" && b.status !== status) return;
      const seg = b2cSegment(b);
      if (!matchesSegment(filter, seg) || !inRange(filter, b.checkin)) return;
      const kids = (b.kidsAbove10 || 0) + (b.kids6to10 || 0) + (b.kids2to6 || 0) + (b.infantsBelow2 || 0);
      const pax = [`${b.adults + (b.seniors || 0)} adults`, kids ? `${kids} kids` : "", b.pets ? `${b.pets} pets` : ""].filter(Boolean).join(", ");
      out.push({ id: b.id, name: b.guest, contact: b.mobile, segment: seg.label, checkin: b.checkin, checkout: b.checkout, nights: stayNights(b.checkin, b.checkout), villas: [...b.allocatedRooms].sort(compareRoomLabels).join(", "), pax, bill: b.grandTotal, received: b.advance, balance: b.balance, status: b.status, by: b.rex, created: b.createdAt ?? "", href: `/bookings/${b.id}` });
    });
    if (status !== "Completed") {
      b2bBookings.forEach((b) => {
        if (b.status !== "Confirmed") return;
        const seg = b2bSegment(b);
        if (!matchesSegment(filter, seg) || !inRange(filter, b.checkin)) return;
        out.push({ id: b.id, name: b.orgName, contact: b.contactNumber, segment: seg.label, checkin: b.checkin, checkout: b.checkout, nights: stayNights(b.checkin, b.checkout), villas: b.bookingType, pax: `${b.pax} pax`, bill: b.grandTotal, received: b.advance, balance: b.balance, status: b.status, by: b.createdBy, created: b.createdAt, href: `/b2b/${b.id}` });
      });
    }
    return out.sort((a, b) => a.checkin.localeCompare(b.checkin));
  }, [bookings, b2bBookings, filter, status]);

  const totals = rows.reduce((t, r) => ({ bill: t.bill + r.bill, received: t.received + r.received, balance: t.balance + r.balance }), { bill: 0, received: 0, balance: 0 });

  const exportCsv = () =>
    downloadCsv(
      csvName("bookings", filter),
      ["Booking ID", "Guest / Organisation", "Contact", "Segment", "Check-in", "Check-out", "Nights", "Villas / Type", "Pax", "Bill", "Received", "Balance", "Status", "Created by", "Created on"],
      [
        ...rows.map((r) => [r.id, r.name, r.contact, r.segment, fmtIN(r.checkin), fmtIN(r.checkout), r.nights, r.villas, r.pax, Math.round(r.bill), Math.round(r.received), Math.round(r.balance), r.status, r.by, r.created ? fmtIN(r.created) : ""]),
        ["Total", "", "", "", "", "", "", "", "", Math.round(totals.bill), Math.round(totals.received), Math.round(totals.balance), "", "", ""],
      ]
    );

  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  const balColor = (v: number) => (v >= 1 ? "var(--amb)" : v <= -1 ? "var(--pur)" : "var(--grn)");
  return (
    <ReportShell
      title="Bookings"
      subtitle="Confirmed and completed bookings. Date range applies to check-in."
      group="data"
      summary={<><span><b>{rows.length}</b> bookings</span><span>Billed <b>{fmt(totals.bill)}</b></span><span>Received <b style={{ color: "var(--grn)" }}>{fmt(totals.received)}</b></span></>}
      filters={
        <ReportFilters
          filter={filter}
          onChange={setFilter}
          today={today}
          dateLabel="Check-in"
          onExport={exportCsv}
          exportDisabled={rows.length === 0}
          extra={
            <div className="report-shortcuts">
              {(["all", "Confirmed", "Completed"] as const).map((s) => (
                <button key={s} type="button" className={`filter-btn${status === s ? " on" : ""}`} onClick={() => setStatus(s)}>
                  {s === "all" ? "Confirmed + Completed" : s}
                </button>
              ))}
            </div>
          }
        />
      }
    >
      <table style={{ minWidth: 1400 }}>
        <thead>
          <tr>
            <th>Booking ID</th><th>Guest / Organisation</th><th>Segment</th><th>Check-in</th><th>Check-out</th><th style={num}>Nights</th>
            <th>Villas / Type</th><th>Pax</th><th style={num}>Bill</th><th style={num}>Received</th><th style={num}>Balance</th><th>Status</th><th>Created by</th><th>Created on</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={15} text="No bookings in this range" /> : (
            <>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.id}</td>
                  <td><div style={{ fontWeight: 500 }}>{r.name}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{r.contact}</div></td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.segment}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkin)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkout)}</td>
                  <td style={num}>{r.nights || "Dayout"}</td>
                  <td style={{ fontSize: 11 }}>{r.villas || "—"}</td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.pax}</td>
                  <td style={num}>{fmt(r.bill)}</td>
                  <td style={{ ...num, color: "var(--grn)" }}>{fmt(r.received)}</td>
                  <td style={{ ...num, fontWeight: 700, color: balColor(r.balance) }}>{r.balance <= -1 ? `−${fmt(-r.balance)}` : fmt(Math.max(0, r.balance))}</td>
                  <td style={{ fontSize: 11 }}>{r.status}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{r.by}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.created ? fmtIN(r.created) : "—"}</td>
                  <td><Link href={r.href} className="btn btn-ghost btn-xs">View</Link></td>
                </tr>
              ))}
              <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                <td colSpan={8} style={{ textAlign: "right", fontSize: 12, color: "var(--t2)" }}>Total</td>
                <td style={num}>{fmt(totals.bill)}</td>
                <td style={{ ...num, color: "var(--grn)" }}>{fmt(totals.received)}</td>
                <td style={{ ...num, color: balColor(totals.balance) }}>{fmt(totals.balance)}</td>
                <td colSpan={4}></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </ReportShell>
  );
}
