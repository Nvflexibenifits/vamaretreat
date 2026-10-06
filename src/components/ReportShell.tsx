"use client";

import type { ReactNode } from "react";
import { useApp } from "@/lib/store";

// Page frame shared by every report: title, role gate, summary line, and the
// table box. Finance sees finance reports only; Front Office sees none.
export function ReportShell({
  title,
  subtitle,
  group,
  summary,
  filters,
  children,
}: {
  title: string;
  subtitle: string;
  group: "finance" | "data";
  summary?: ReactNode;
  filters: ReactNode;
  children: ReactNode;
}) {
  const { currentRole, hydrated } = useApp();
  const blocked = currentRole === "Front Office" || (currentRole === "Finance" && group === "data");
  if (blocked) {
    return (
      <div className="view">
        <div className="pg-hd"><div><h2>{title}</h2><p>This report is not available for your role.</p></div></div>
      </div>
    );
  }
  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {summary && <div className="report-summary">{summary}</div>}
      </div>
      {filters}
      {!hydrated ? (
        <div className="tbl-wrap" style={{ padding: 24, color: "var(--t3)", fontSize: 13 }}>Loading…</div>
      ) : (
        <div className="tbl-wrap">
          <div style={{ overflowX: "auto" }}>{children}</div>
        </div>
      )}
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <div className="empty-state"><h3>{text}</h3><p>Try widening the filters</p></div>
      </td>
    </tr>
  );
}
