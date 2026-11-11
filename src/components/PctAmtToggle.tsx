"use client";

// Refund and credit note on a cancellation can be set as a share of what was
// paid or as a rupee figure. A multi-night stay that drops rooms on one night
// only needs a worked-out figure, not a percentage.
export type CancelBy = "pct" | "amt";

export const FIGURE_INPUT: React.CSSProperties = {
  width: 64,
  height: 30,
  padding: "0 8px",
  fontSize: 13,
  textAlign: "right",
  border: "1px solid var(--bd)",
  borderRadius: "var(--r2)",
  background: "var(--surf)",
  color: "var(--t1)",
  outline: "none",
};

export function PctAmtToggle({ value, onChange }: { value: CancelBy; onChange: (v: CancelBy) => void }) {
  const btn = (v: CancelBy, label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      title={v === "pct" ? "Share of the amount paid" : "Rupee amount"}
      style={{
        height: 30, padding: "0 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        border: "1px solid var(--bd)", marginLeft: v === "amt" ? -1 : 0,
        borderRadius: v === "pct" ? "var(--r2) 0 0 var(--r2)" : "0 var(--r2) var(--r2) 0",
        background: value === v ? "var(--t1)" : "var(--surf)", color: value === v ? "var(--surf)" : "var(--t2)",
      }}
    >
      {label}
    </button>
  );
  return <span style={{ display: "inline-flex" }}>{btn("pct", "%")}{btn("amt", "₹")}</span>;
}
