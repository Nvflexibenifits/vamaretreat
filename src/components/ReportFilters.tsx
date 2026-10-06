"use client";

import type { ReactNode } from "react";
import { OTA_PROVIDERS } from "@/types";
import { B2B_TYPES, shortcutRange, type ReportFilter } from "@/lib/reports";

// One flat list of every business line, so a user picks exactly the slice
// they want in a single step: each OTA provider and each B2B type on its
// own, with the group totals still one click away.
const SEGMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "all:", label: "All" },
  { value: "b2c-direct:", label: "B2C · Direct" },
  { value: "b2c-ota:", label: "B2C · OTA (all)" },
  ...OTA_PROVIDERS.map((p) => ({ value: `b2c-ota:${p.id}`, label: `B2C · OTA · ${p.name}` })),
  { value: "b2b:", label: "B2B (all)" },
  ...B2B_TYPES.map((t) => ({ value: `b2b:${t}`, label: `B2B · ${t}` })),
];

// The filter bar every report shares: business segment with its sub-choice,
// an inclusive date range with shortcuts, any report-specific controls, and
// the export button. Reports own the state; this only renders and edits it.
export function ReportFilters({
  filter,
  onChange,
  today,
  dateLabel,
  extra,
  onExport,
  exportDisabled,
}: {
  filter: ReportFilter;
  onChange: (f: ReportFilter) => void;
  today: string;
  dateLabel: string;
  extra?: ReactNode;
  onExport: () => void;
  exportDisabled?: boolean;
}) {
  const set = (patch: Partial<ReportFilter>) => onChange({ ...filter, ...patch });
  const ctl: React.CSSProperties = {
    height: 32, padding: "0 10px", fontSize: 13, border: "1px solid var(--bd)", borderRadius: "var(--r2)",
    background: "var(--surf)", color: "var(--t1)",
  };
  const isRange = (k: "today" | "week" | "month") => {
    const r = shortcutRange(k, today);
    return filter.from === r.from && filter.to === r.to;
  };
  return (
    <div className="report-filters">
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
          {SEGMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="report-filter">
        <span>{dateLabel} from</span>
        <input type="date" value={filter.from} onChange={(e) => set({ from: e.target.value })} style={ctl} />
      </label>
      <label className="report-filter">
        <span>to</span>
        <input type="date" value={filter.to} onChange={(e) => set({ to: e.target.value })} style={ctl} />
      </label>
      <div className="report-shortcuts">
        {(["today", "week", "month"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={`filter-btn${isRange(k) ? " on" : ""}`}
            onClick={() => set(shortcutRange(k, today))}
          >
            {k === "today" ? "Today" : k === "week" ? "This Week" : "This Month"}
          </button>
        ))}
        {(filter.from || filter.to) && (
          <button type="button" className="filter-btn" onClick={() => set({ from: "", to: "" })}>Clear</button>
        )}
      </div>
      {extra}
      <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={onExport} disabled={exportDisabled}>
        Export to Excel
      </button>
    </div>
  );
}
