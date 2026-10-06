"use client";

import type { ReactNode } from "react";
import { OTA_PROVIDERS } from "@/types";
import { B2B_TYPES, shortcutRange, type ReportFilter } from "@/lib/reports";

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
        <select value={filter.segment} onChange={(e) => set({ segment: e.target.value as ReportFilter["segment"], sub: "" })} style={ctl}>
          <option value="all">All</option>
          <option value="b2c-direct">B2C · Direct</option>
          <option value="b2c-ota">B2C · OTA</option>
          <option value="b2b">B2B</option>
        </select>
      </label>
      {filter.segment === "b2c-ota" && (
        <label className="report-filter">
          <span>Provider</span>
          <select value={filter.sub} onChange={(e) => set({ sub: e.target.value })} style={ctl}>
            <option value="">All providers</option>
            {OTA_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
          </select>
        </label>
      )}
      {filter.segment === "b2b" && (
        <label className="report-filter">
          <span>Type</span>
          <select value={filter.sub} onChange={(e) => set({ sub: e.target.value })} style={ctl}>
            <option value="">All types</option>
            {B2B_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}
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
