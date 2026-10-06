"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ReportFilters } from "@/components/ReportFilters";
import { EmptyRow, ReportShell } from "@/components/ReportShell";
import { fmt, fmtIN, todayStr } from "@/lib/utils";
import { b2bSegment, b2cSegment, csvName, downloadCsv, emptyFilter, inRange, matchesSegment, roomsWanted, stayNights } from "@/lib/reports";

type Row = {
  id: string; name: string; contact: string; segment: string; checkin: string; checkout: string; nights: number;
  wanted: string; quoted: number; status: string; reason: string; notes: string; by: string; created: string; href: string;
};

// Enquiries and tentative bookings that never converted, with the reason,
// or the ones still open. B2B has no Lost status, so a B2B enquiry counts as
// lost once its check-in date has passed without confirmation.
export default function LostReport() {
  const { bookings, b2bBookings } = useApp();
  const [today] = useState(() => todayStr());
  const [filter, setFilter] = useState(() => emptyFilter());
  const [view, setView] = useState<"lost" | "open">("lost");

  const rows = useMemo(() => {
    const out: Row[] = [];
    bookings.forEach((b) => {
      const lost = b.status === "Lost";
      const open = b.status === "Enquiry" || b.status === "Tentative";
      if (!(view === "lost" ? lost : open)) return;
      const seg = b2cSegment(b);
      if (!matchesSegment(filter, seg) || !inRange(filter, b.checkin)) return;
      out.push({ id: b.id, name: b.guest, contact: b.mobile, segment: seg.label, checkin: b.checkin, checkout: b.checkout, nights: stayNights(b.checkin, b.checkout), wanted: roomsWanted(b), quoted: b.grandTotal, status: b.status, reason: b.lostReason ?? "", notes: b.lostNotes ?? "", by: b.rex, created: b.createdAt ?? "", href: `/bookings/${b.id}` });
    });
    b2bBookings.forEach((b) => {
      if (b.status !== "Enquiry" && b.status !== "Tentative") return;
      const lapsed = b.checkin < today;
      if (!(view === "lost" ? lapsed : !lapsed)) return;
      const seg = b2bSegment(b);
      if (!matchesSegment(filter, seg) || !inRange(filter, b.checkin)) return;
      out.push({ id: b.id, name: b.orgName, contact: b.contactNumber, segment: seg.label, checkin: b.checkin, checkout: b.checkout, nights: stayNights(b.checkin, b.checkout), wanted: `${b.bookingType} · ${b.pax} pax`, quoted: b.grandTotal, status: lapsed ? `${b.status} · not confirmed` : b.status, reason: lapsed ? "Check-in date passed" : "", notes: "", by: b.createdBy, created: b.createdAt, href: `/b2b/${b.id}` });
    });
    return out.sort((a, b) => b.checkin.localeCompare(a.checkin));
  }, [bookings, b2bBookings, filter, view, today]);

  const quoted = rows.reduce((s, r) => s + r.quoted, 0);

  const exportCsv = () =>
    downloadCsv(
      csvName(view === "lost" ? "lost_bookings" : "open_enquiries", filter),
      ["Booking ID", "Guest / Organisation", "Contact", "Segment", "Check-in", "Check-out", "Nights", "Rooms wanted", "Quoted", "Status", "Reason", "Notes", "Handled by", "Created"],
      [
        ...rows.map((r) => [r.id, r.name, r.contact, r.segment, fmtIN(r.checkin), fmtIN(r.checkout), r.nights, r.wanted, Math.round(r.quoted), r.status, r.reason, r.notes, r.by, r.created ? fmtIN(r.created) : ""]),
        ["Total", "", "", "", "", "", "", "", Math.round(quoted), "", "", "", "", ""],
      ]
    );

  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  return (
    <ReportShell
      title="Enquiries / Lost Bookings"
      subtitle="Enquiries and tentative bookings that did not convert, and what is still open. Date range applies to check-in."
      group="data"
      summary={<><span><b>{rows.length}</b> {view === "lost" ? "lost" : "open"}</span><span>Quoted <b>{fmt(quoted)}</b></span></>}
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
              <button type="button" className={`filter-btn${view === "lost" ? " on" : ""}`} onClick={() => setView("lost")}>Lost</button>
              <button type="button" className={`filter-btn${view === "open" ? " on" : ""}`} onClick={() => setView("open")}>Still open</button>
            </div>
          }
        />
      }
    >
      <table style={{ minWidth: 1300 }}>
        <thead>
          <tr>
            <th>Booking ID</th><th>Guest / Organisation</th><th>Segment</th><th>Check-in</th><th>Check-out</th><th style={num}>Nights</th>
            <th>Rooms wanted</th><th style={num}>Quoted</th><th>Status</th><th>Reason</th><th>Notes</th><th>Handled by</th><th>Created</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={14} text={view === "lost" ? "No lost bookings in this range" : "No open enquiries in this range"} /> : (
            <>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.id}</td>
                  <td><div style={{ fontWeight: 500 }}>{r.name}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{r.contact}</div></td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.segment}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkin)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkout)}</td>
                  <td style={num}>{r.nights || "Dayout"}</td>
                  <td style={{ fontSize: 11 }}>{r.wanted || "—"}</td>
                  <td style={num}>{fmt(r.quoted)}</td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.status}</td>
                  <td style={{ fontSize: 11, color: "var(--red)" }}>{r.reason || "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)", maxWidth: 220 }}>{r.notes || ""}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{r.by}</td>
                  <td style={{ fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.created ? fmtIN(r.created) : "—"}</td>
                  <td><Link href={r.href} className="btn btn-ghost btn-xs">View</Link></td>
                </tr>
              ))}
              <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                <td colSpan={7} style={{ textAlign: "right", fontSize: 12, color: "var(--t2)" }}>Total quoted</td>
                <td style={num}>{fmt(quoted)}</td>
                <td colSpan={6}></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </ReportShell>
  );
}
