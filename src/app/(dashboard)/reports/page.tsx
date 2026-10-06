"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";

const FINANCE = [
  { href: "/reports/payment-pending", title: "Payment Pending", desc: "Confirmed and completed stays still owing money, with totals by segment." },
  { href: "/reports/payments-received", title: "Payments Received", desc: "Every receipt by date, mode and segment, for end-of-day bank and cash reconciliation." },
];
const DATA = [
  { href: "/reports/lost", title: "Enquiries / Lost", desc: "Enquiries and tentative bookings that did not convert, with reasons, and what is still open." },
  { href: "/reports/bookings", title: "Bookings", desc: "Confirmed and completed bookings across B2C and B2B with villas, pax and money." },
];

export default function ReportsPage() {
  const { currentRole } = useApp();
  if (currentRole === "Front Office") {
    return (
      <div className="view">
        <div className="pg-hd"><div><h2>Reports</h2><p>Reports are not available for your role.</p></div></div>
      </div>
    );
  }
  const groups = currentRole === "Finance" ? [["Finance Reports", FINANCE]] as const : [["Finance Reports", FINANCE], ["Data Reports", DATA]] as const;
  return (
    <div className="view">
      <div className="pg-hd"><div><h2>Reports</h2><p>Every report shares the same segment and date filters and exports to Excel.</p></div></div>
      {groups.map(([title, items]) => (
        <div key={title} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>{title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
            {items.map((r) => (
              <Link key={r.href} href={r.href} className="card" style={{ textDecoration: "none", display: "block" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>{r.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
