"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ReportFilters } from "@/components/ReportFilters";
import { EmptyRow, ReportShell } from "@/components/ReportShell";
import { b2bStatusNow, fmtIN, isGroupBooking, todayStr } from "@/lib/utils";
import {
  b2bSegment, b2cSegment, csvName, downloadCsv, emptyFilter, inRange, matchesSegment, paxBreakdown,
  type Line, type PaxBreakdown,
} from "@/lib/reports";

type Kind = "lost" | "completed";
type Row = {
  id: string; segment: string; checkin: string; checkout: string; pax: PaxBreakdown; total: number; href: string;
  // B2B only: the organisation and who to call, in place of the guest counts
  org?: string; contact?: string; phone?: string;
};

const NO_PAX: PaxBreakdown = { adults: 0, seniors: 0, under10: 0, over10: 0, pets: 0 };

const COPY: Record<Line, Record<Kind, { title: string; subtitle: string; empty: string }>> = {
  b2c: {
    lost: {
      title: "B2C Enquiries Lost",
      subtitle: "Enquiries and tentative bookings that were lost, with who was coming. Only lost records, nothing still open. Date range applies to check-in.",
      empty: "No lost enquiries in this range",
    },
    completed: {
      title: "B2C Bookings Completed",
      subtitle: "Stays that took place, with who came. Same columns as Enquiries Lost. Date range applies to check-in.",
      empty: "No completed bookings in this range",
    },
  },
  b2b: {
    lost: {
      title: "B2B Enquiries Lost",
      subtitle: "Enquiries and tentative bookings that were lost, including any whose check-in passed without confirmation, with the company and who to call. Date range applies to check-in.",
      empty: "No lost enquiries in this range",
    },
    completed: {
      title: "B2B Bookings Completed",
      subtitle: "Confirmed bookings whose dates have passed, with the company and who to call. Date range applies to check-in.",
      empty: "No completed bookings in this range",
    },
  },
  group: {
    lost: {
      title: "Group Enquiries Lost",
      subtitle: "Group enquiries and tentative bookings that were lost, with who was coming. Only lost records, nothing still open. Date range applies to check-in.",
      empty: "No lost group enquiries in this range",
    },
    completed: {
      title: "Group Bookings Completed",
      subtitle: "Group stays that took place, with who came. Same columns as Enquiries Lost. Date range applies to check-in.",
      empty: "No completed group bookings in this range",
    },
  },
};

// Marketing's view of what did not convert and what did: which segment, when,
// and how many adults, seniors, kids and pets. No money, no guest details;
// the View link opens the booking when someone needs more. The B2B lists
// carry the company and contact instead, since that is what a follow-up
// call needs and the export has no View link.
export function PaxReport({ line, kind }: { line: Line; kind: Kind }) {
  const { bookings, b2bBookings } = useApp();
  const [today] = useState(() => todayStr());
  const [filter, setFilter] = useState(() => emptyFilter());
  const want = kind === "lost" ? "Lost" : "Completed";
  const copy = COPY[line][kind];

  // B2C and Group share one table: the group section reads only group rows
  // and the B2C section leaves them out.
  const rows = useMemo(() => {
    const out: Row[] = [];
    if (line !== "b2b") {
      bookings.forEach((b) => {
        if (b.status !== want || isGroupBooking(b) !== (line === "group")) return;
        const seg = b2cSegment(b);
        if (!matchesSegment(filter, seg) || !inRange(filter, b.checkin)) return;
        const pax = paxBreakdown(b);
        out.push({
          id: b.id, segment: seg.label.replace(/^B2C · /, ""), checkin: b.checkin, checkout: b.checkout, pax,
          total: pax.adults + pax.seniors + pax.under10 + pax.over10, href: `/bookings/${b.id}`,
        });
      });
    } else {
      b2bBookings.forEach((b) => {
        if (b2bStatusNow(b, today) !== want) return;
        const seg = b2bSegment(b);
        if (!matchesSegment(filter, seg) || !inRange(filter, b.checkin)) return;
        out.push({
          id: b.id, segment: b.type, checkin: b.checkin, checkout: b.checkout, pax: NO_PAX, total: b.pax || 0,
          org: b.orgName, contact: b.contactPerson, phone: b.contactNumber, href: `/b2b/${b.id}`,
        });
      });
    }
    // Latest check-in first: the recent past is what a campaign targets
    return out.sort((a, b) => b.checkin.localeCompare(a.checkin) || a.id.localeCompare(b.id));
  }, [bookings, b2bBookings, filter, line, want, today]);

  const totals = rows.reduce(
    (t, r) => ({
      adults: t.adults + r.pax.adults, seniors: t.seniors + r.pax.seniors, under10: t.under10 + r.pax.under10,
      over10: t.over10 + r.pax.over10, pets: t.pets + r.pax.pets, total: t.total + r.total,
    }),
    { ...NO_PAX, total: 0 }
  );

  // Group rows carry the same guest breakdown as B2C; B2B lists the company
  // and contact instead of counts
  const paxCols = line !== "b2b";
  const exportCsv = () =>
    paxCols
      ? downloadCsv(
          csvName(`${line}_${kind}`, filter),
          ["Booking ID", "Segment", "Check-in", "Check-out", "Adults", "Senior citizens", "Kids under 10", "Kids over 10", "Pets"],
          [
            ...rows.map((r) => [r.id, r.segment, fmtIN(r.checkin), fmtIN(r.checkout), r.pax.adults, r.pax.seniors, r.pax.under10, r.pax.over10, r.pax.pets]),
            ["Total", "", "", "", totals.adults, totals.seniors, totals.under10, totals.over10, totals.pets],
          ]
        )
      : downloadCsv(
          csvName(`b2b_${kind}`, filter),
          ["Booking ID", "Segment", "Company", "Contact name", "Contact number", "Check-in"],
          rows.map((r) => [r.id, r.segment, r.org ?? "", r.contact ?? "", r.phone ?? "", fmtIN(r.checkin)])
        );

  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  const cols = paxCols ? 10 : 7;
  const word = kind === "lost" ? "lost" : "completed";
  return (
    <ReportShell
      title={copy.title}
      subtitle={copy.subtitle}
      group="data"
      summary={
        paxCols ? (
          <>
            <span><b>{rows.length}</b> {word}</span>
            <span>Adults <b>{totals.adults + totals.seniors}</b></span>
            <span>Kids <b>{totals.under10 + totals.over10}</b></span>
            <span>Pets <b>{totals.pets}</b></span>
          </>
        ) : (
          <span><b>{rows.length}</b> {word}</span>
        )
      }
      filters={
        <ReportFilters
          filter={filter}
          onChange={setFilter}
          today={today}
          dateLabel="Check-in"
          line={line}
          onExport={exportCsv}
          exportDisabled={rows.length === 0}
        />
      }
    >
      <table style={{ minWidth: paxCols ? 900 : 760 }}>
        <thead>
          <tr>
            {paxCols ? (
              <>
                <th>Booking ID</th><th>Segment</th><th>Check-in</th><th>Check-out</th>
                <th style={num}>Adults</th>
                <th style={num}>Senior citizens</th>
                <th style={num} title="Kids 6 to 10, 2 to 6, and infants under 2">Kids under 10</th>
                <th style={num}>Kids over 10</th>
                <th style={num}>Pets</th>
              </>
            ) : (
              <>
                <th>Booking ID</th><th>Segment</th><th>Company</th><th>Contact name</th><th>Contact number</th><th>Check-in</th>
              </>
            )}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={cols} text={copy.empty} /> : (
            <>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", whiteSpace: "nowrap" }}>{r.id}</td>
                  <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.segment}</td>
                  {paxCols ? (
                    <>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkin)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.checkout === r.checkin ? "Dayout" : fmtIN(r.checkout)}</td>
                      <td style={num}>{r.pax.adults}</td>
                      <td style={num}>{r.pax.seniors || "—"}</td>
                      <td style={num}>{r.pax.under10 || "—"}</td>
                      <td style={num}>{r.pax.over10 || "—"}</td>
                      <td style={num}>{r.pax.pets || "—"}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight: 500 }}>{r.org || "—"}</td>
                      <td>{r.contact || "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.phone || "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtIN(r.checkin)}{r.checkout === r.checkin ? " · Dayout" : ""}</td>
                    </>
                  )}
                  <td><Link href={r.href} className="btn btn-ghost btn-xs">View</Link></td>
                </tr>
              ))}
              {paxCols && (
                <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                  <td colSpan={4} style={{ textAlign: "right", fontSize: 12, color: "var(--t2)" }}>Total</td>
                  <td style={num}>{totals.adults}</td>
                  <td style={num}>{totals.seniors}</td>
                  <td style={num}>{totals.under10}</td>
                  <td style={num}>{totals.over10}</td>
                  <td style={num}>{totals.pets}</td>
                  <td></td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </ReportShell>
  );
}
