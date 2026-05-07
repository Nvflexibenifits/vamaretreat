"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/utils";

export default function RevenuePage() {
  const router = useRouter();
  const { revenueEntries, bookings } = useApp();
  const [monthFilter, setMonthFilter] = useState("2026-05");

  let entries = revenueEntries.filter((e) => e.amount > 0);
  if (monthFilter) entries = entries.filter((e) => e.date && e.date.startsWith(monthFilter));

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const pending = bookings.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const confirmed = bookings.filter((b) => b.status === "Confirmed").length;

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Revenue</h2>
          <p>Auto-populated from all payment events — real-time, per booking</p>
        </div>
        <div className="pg-hd-actions">
          <select
            className="btn btn-ghost btn-sm"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">All Time</option>
            <option value="2026-05">May 2026</option>
            <option value="2026-04">April 2026</option>
            <option value="2026-03">March 2026</option>
          </select>
          <button className="btn btn-ghost btn-sm">⬇ Export CSV</button>
        </div>
      </div>

      <div className="rev-summary">
        <div className="rev-card">
          <div className="rev-card-lbl">Total Collected</div>
          <div className="rev-card-val">{fmt(total)}</div>
          <div className="rev-card-sub">{entries.length} payment events</div>
        </div>
        <div className="rev-card">
          <div className="rev-card-lbl">Balance Pending</div>
          <div className="rev-card-val" style={{ color: "var(--amb)" }}>{fmt(pending)}</div>
          <div className="rev-card-sub">Across confirmed bookings</div>
        </div>
        <div className="rev-card">
          <div className="rev-card-lbl">Confirmed Bookings</div>
          <div className="rev-card-val">{confirmed}</div>
          <div className="rev-card-sub">In house / upcoming</div>
        </div>
      </div>

      <div className="tbl-wrap">
        <div className="tbl-hd">
          <h3>Revenue Ledger — All Payment Events</h3>
          <span className="tbl-hd-r" style={{ fontSize: 12, color: "var(--t3)" }}>
            {entries.length} entries
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Booking ID</th>
              <th>Guest</th>
              <th>Event</th>
              <th>Amount</th>
              <th>Mode</th>
              <th>Collected by</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} onClick={() => router.push(`/bookings/${e.bookingId}`)}>
                <td>{e.date}</td>
                <td>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--t3)", fontWeight: 700 }}>
                    {e.bookingId}
                  </span>
                </td>
                <td style={{ fontWeight: 500, color: "var(--t1)" }}>{e.guest}</td>
                <td>
                  <span className={`badge ${e.type.includes("Extra") ? "bd-pending" : "bd-active"}`}>
                    {e.type}
                  </span>
                </td>
                <td style={{ fontWeight: 700, color: "var(--t1)" }}>{fmt(e.amount)}</td>
                <td>{e.mode}</td>
                <td style={{ fontSize: 12, color: "var(--t3)" }}>{e.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
