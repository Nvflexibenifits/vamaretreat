"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";

const B2C = [
  { href: "/bookings", title: "B2C Bookings", desc: "The open list: tentative and confirmed bookings checking in from today onwards." },
  { href: "/reports/b2c/lost", title: "B2C Enquiries Lost", desc: "Lost enquiries with adults, senior citizens, kids and pets, for campaign planning." },
  { href: "/reports/b2c/completed", title: "B2C Bookings Completed", desc: "Stays that took place, with the same guest breakdown." },
  { href: "/reports/b2c/conversion", title: "B2C Conversion", desc: "Enquiries against completed stays, month by month for a year." },
];
const B2B = [
  { href: "/b2b", title: "B2B Bookings", desc: "The open list: tentative and confirmed corporate, school and institute bookings from today onwards." },
  { href: "/reports/b2b/lost", title: "B2B Enquiries Lost", desc: "Lost enquiries by segment with dates and pax." },
  { href: "/reports/b2b/completed", title: "B2B Bookings Completed", desc: "Confirmed bookings whose dates have passed." },
  { href: "/reports/b2b/conversion", title: "B2B Conversion", desc: "Enquiries against completed bookings, month by month for a year." },
];
const GROUP = [
  { href: "/group-bookings", title: "Group Bookings", desc: "The open list: tentative and confirmed group bookings checking in from today onwards." },
  { href: "/reports/group/lost", title: "Group Enquiries Lost", desc: "Lost group enquiries with adults, senior citizens, kids and pets." },
  { href: "/reports/group/completed", title: "Group Bookings Completed", desc: "Group stays that took place, with the same guest breakdown." },
  { href: "/reports/group/conversion", title: "Group Conversion", desc: "Group enquiries against completed stays, month by month for a year." },
];
const FINANCE = [
  { href: "/reports/payment-pending", title: "Payment Pending", desc: "Confirmed and completed stays still owing money, with totals by segment." },
  { href: "/reports/payments-received", title: "Payments Received", desc: "Every receipt by date, mode and segment, for end-of-day bank and cash reconciliation." },
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
  const groups =
    currentRole === "Finance"
      ? ([["Finance", FINANCE]] as const)
      : ([["B2C", B2C], ["B2B", B2B], ["Group", GROUP], ["Finance", FINANCE]] as const);
  return (
    <div className="view">
      <div className="pg-hd"><div><h2>Reports</h2><p>Each team has its own section. Reports filter by segment, month or date range, and export to Excel.</p></div></div>
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
