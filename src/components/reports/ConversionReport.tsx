"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ReportShell } from "@/components/ReportShell";
import { b2bStatusNow, isGroupBooking, todayStr } from "@/lib/utils";
import {
  LINE_LABEL, MONTH_SHORT, b2bSegment, b2cSegment, downloadCsv, matchesSegment, segmentOptions,
  type Line, type ReportFilter, type SegmentInfo,
} from "@/lib/reports";

type Rec = { checkin: string; done: boolean; seg: SegmentInfo };

// How much of what came in actually happened, month by month for one year.
// An enquiry is every booking that checks in that month, whatever became of
// it; completed is the stays that took place, not the ones merely confirmed.
// Future months have nothing to convert yet, so the year line stops at the
// current month.
export function ConversionReport({ line }: { line: Line }) {
  const { bookings, b2bBookings } = useApp();
  const [today] = useState(() => todayStr());
  const [year, setYear] = useState(() => today.slice(0, 4));
  const [segment, setSegment] = useState("all:");

  // B2C and Group share one table: each section counts only its own rows
  const recs = useMemo<Rec[]>(
    () =>
      line === "b2b"
        ? b2bBookings.map((b) => ({ checkin: b.checkin, done: b2bStatusNow(b, today) === "Completed", seg: b2bSegment(b) }))
        : bookings
            .filter((b) => isGroupBooking(b) === (line === "group"))
            .map((b) => ({ checkin: b.checkin, done: b.status === "Completed", seg: b2cSegment(b) })),
    [bookings, b2bBookings, line, today]
  );

  const years = useMemo(() => {
    const set = new Set(recs.map((r) => r.checkin.slice(0, 4)).filter((y) => /^\d{4}$/.test(y)));
    set.add(today.slice(0, 4));
    return [...set].sort().reverse();
  }, [recs, today]);

  const filt = useMemo<ReportFilter>(() => {
    const [seg, sub = ""] = segment.split(":");
    return { segment: seg as ReportFilter["segment"], sub, from: "", to: "" };
  }, [segment]);

  const thisMonth = today.slice(0, 7);
  const months = useMemo(
    () =>
      MONTH_SHORT.map((name, i) => {
        const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
        const inMonth = recs.filter((r) => r.checkin.startsWith(ym) && matchesSegment(filt, r.seg));
        return { ym, label: `${name} ${year}`, total: inMonth.length, done: inMonth.filter((r) => r.done).length, future: ym > thisMonth };
      }),
    [recs, year, filt, thisMonth]
  );

  const counted = months.filter((m) => !m.future);
  const ytd = counted.reduce((t, m) => ({ total: t.total + m.total, done: t.done + m.done }), { total: 0, done: 0 });
  const isThisYear = year === today.slice(0, 4);
  const pct = (done: number, total: number) => (total > 0 ? `${((done / total) * 100).toFixed(1)}%` : "—");
  const lineLabel = LINE_LABEL[line];
  const segments = segmentOptions(line);

  const exportCsv = () =>
    downloadCsv(
      `${line}_conversion_${year}${segment === "all:" ? "" : `_${segment.replace(":", "-").replace(/-$/, "")}`}.csv`,
      ["Month", "Enquiries", "Completed", "Conversion %"],
      [
        ...months.map((m) => [m.label, m.total, m.future ? "" : m.done, m.future ? "" : pct(m.done, m.total)]),
        [isThisYear ? "Year to date" : "Year total", ytd.total, ytd.done, pct(ytd.done, ytd.total)],
      ]
    );

  const ctl: React.CSSProperties = {
    height: 32, padding: "0 10px", fontSize: 13, border: "1px solid var(--bd)", borderRadius: "var(--r2)",
    background: "var(--surf)", color: "var(--t1)",
  };
  const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
  return (
    <ReportShell
      title={`${lineLabel} Conversion`}
      subtitle="Enquiries received against stays completed, month by month. Enquiries count every booking checking in that month whatever its status today; completed counts the stays that took place."
      group="data"
      summary={
        <>
          <span>{isThisYear ? "Year to date" : "Year"} <b>{pct(ytd.done, ytd.total)}</b></span>
          <span><b>{ytd.done}</b> of <b>{ytd.total}</b> completed</span>
        </>
      }
      filters={
        <div className="report-filters">
          {segments.length > 1 && (
            <label className="report-filter">
              <span>Segment</span>
              <select value={segment} onChange={(e) => setSegment(e.target.value)} style={ctl}>
                {segments.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
          <label className="report-filter">
            <span>Year</span>
            <select value={year} onChange={(e) => setYear(e.target.value)} style={ctl}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={exportCsv} disabled={ytd.total === 0}>
            Export to Excel
          </button>
        </div>
      }
    >
      <table style={{ minWidth: 520 }}>
        <thead>
          <tr>
            <th>Month</th>
            <th style={num} title="Every booking with a check-in in the month, whatever its status today">Enquiries</th>
            <th style={num} title="Stays that took place">Completed</th>
            <th style={num}>Conversion</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.ym} style={m.future ? { color: "var(--t3)" } : undefined}>
              <td style={{ whiteSpace: "nowrap" }}>{m.label}</td>
              <td style={num}>{m.total}</td>
              <td style={num}>{m.future ? "—" : m.done}</td>
              <td style={{ ...num, fontWeight: m.future ? 400 : 700 }}>{m.future ? (m.total > 0 ? "upcoming" : "—") : pct(m.done, m.total)}</td>
            </tr>
          ))}
          <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
            <td>{isThisYear ? "Year to date" : "Year total"}</td>
            <td style={num}>{ytd.total}</td>
            <td style={num}>{ytd.done}</td>
            <td style={num}>{pct(ytd.done, ytd.total)}</td>
          </tr>
        </tbody>
      </table>
    </ReportShell>
  );
}
