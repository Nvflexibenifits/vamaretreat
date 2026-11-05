"use client";

import type { ReactNode } from "react";

// The headline figures above a finance page: one card per number, laid out
// in a row that wraps on narrow screens.
export function SummaryCards({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
      {children}
    </div>
  );
}

export function SummaryCard({ label, value, color, note, title }: { label: string; value: string; color?: string; note?: string; title?: string }) {
  return (
    <div title={title} style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? "var(--sb)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{note}</div>}
    </div>
  );
}
