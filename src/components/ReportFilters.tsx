"use client";

import type { ReactNode } from "react";
import { monthOptions, monthRange, segmentOptions, type Line, type ReportFilter } from "@/lib/reports";

// The filter bar every report shares: business segment, a month picker, an
// inclusive date range, any report-specific controls, and the export button.
// Reports own the state; this only renders and edits it. A section report
// passes its line so the segment list holds only that team's choices. The
// finance reports switch parts off: Payments Received wants Today and a
// range but no month; Payment Pending wants no dates at all.
export function ReportFilters({
  filter,
  onChange,
  today,
  dateLabel,
  line = "all",
  month: showMonth = true,
  dates: showDates = true,
  todayButton = false,
  extra,
  onExport,
  exportDisabled,
}: {
  filter: ReportFilter;
  onChange: (f: ReportFilter) => void;
  today: string;
  dateLabel: string;
  line?: Line | "all";
  month?: boolean;
  dates?: boolean;
  todayButton?: boolean;
  extra?: ReactNode;
  onExport: () => void;
  exportDisabled?: boolean;
}) {
  const set = (patch: Partial<ReportFilter>) => onChange({ ...filter, ...patch });
  const ctl: React.CSSProperties = {
    height: 32, padding: "0 10px", fontSize: 13, border: "1px solid var(--bd)", borderRadius: "var(--r2)",
    background: "var(--surf)", color: "var(--t1)",
  };
  const months = monthOptions(today);
  const segments = segmentOptions(line);
  // The month box shows a month only while the range spans exactly that month
  const month =
    months.find((m) => {
      const r = monthRange(m.value);
      return r.from === filter.from && r.to === filter.to;
    })?.value ?? "";
  return (
    <div className="report-filters">
      {segments.length > 1 && (
        <label className="report-filter">
          <span>Segment</span>
          <select
            value={`${filter.segment}:${filter.sub}`}
            onChange={(e) => {
              const [segment, sub = ""] = e.target.value.split(":");
              set({ segment: segment as ReportFilter["segment"], sub });
            }}
            style={ctl}
          >
            {segments.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      )}
      {showMonth && (
        <label className="report-filter">
          <span>Month</span>
          <select
            value={month}
            onChange={(e) => set(e.target.value ? monthRange(e.target.value) : { from: "", to: "" })}
            style={ctl}
          >
            <option value="">Any</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
      )}
      {showDates && (
        <>
          <label className="report-filter">
            <span>{dateLabel} from</span>
            <input type="date" value={filter.from} onChange={(e) => set({ from: e.target.value })} style={ctl} />
          </label>
          <label className="report-filter">
            <span>to</span>
            <input type="date" value={filter.to} onChange={(e) => set({ to: e.target.value })} style={ctl} />
          </label>
          {(todayButton || filter.from || filter.to) && (
            <div className="report-shortcuts">
              {todayButton && (
                <button
                  type="button"
                  className={`filter-btn${filter.from === today && filter.to === today ? " on" : ""}`}
                  onClick={() => set({ from: today, to: today })}
                >
                  Today
                </button>
              )}
              {(filter.from || filter.to) && (
                <button type="button" className="filter-btn" onClick={() => set({ from: "", to: "" })}>Clear</button>
              )}
            </div>
          )}
        </>
      )}
      {extra}
      <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={onExport} disabled={exportDisabled}>
        Export to Excel
      </button>
    </div>
  );
}
