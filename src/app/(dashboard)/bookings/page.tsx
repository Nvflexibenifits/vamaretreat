"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import type { BookingStatus } from "@/types";

const FILTERS: ("All" | BookingStatus)[] = ["All", "Draft", "Confirmed", "Completed", "Lost"];

export default function BookingsPage() {
  const { bookings } = useApp();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"All" | BookingStatus>("All");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const data = bookings.filter((b) => {
    if (statusFilter !== "All" && b.status !== statusFilter) return false;
    const s = search.toLowerCase();
    if (
      s &&
      !b.guest.toLowerCase().includes(s) &&
      !b.id.toLowerCase().includes(s) &&
      !b.mobile.includes(s)
    )
      return false;
    if (from && b.checkin < from) return false;
    if (to && b.checkin > to) return false;
    return true;
  });

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>All Bookings</h2>
          <p>Full enquiry register — all statuses</p>
        </div>
        <div className="pg-hd-actions">
          <Link href="/bookings/new" className="btn btn-primary">
            ＋ New Booking
          </Link>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <input
            className="search-inp"
            placeholder="Search guest, ID, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-btn${statusFilter === f ? " on" : ""}`}
            onClick={() => setStatusFilter(f)}
          >
            {f}
          </button>
        ))}
        <div className="date-filter-wrap">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Guest</th>
              <th>Source</th>
              <th>Check-in</th>
              <th>Nights</th>
              <th>Rooms</th>
              <th>Total</th>
              <th>Balance</th>
              <th>Status</th>
              <th>REX</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <h3>No bookings found</h3>
                    <p>Try adjusting your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((b) => (
                <tr key={b.id} onClick={() => router.push(`/bookings/${b.id}`)}>
                  <td>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--t3)", fontWeight: 700 }}>
                      {b.id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--t1)" }}>{b.guest}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>{b.mobile}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: "var(--t3)" }}>{b.source || "—"}</span>
                  </td>
                  <td>{b.checkin}</td>
                  <td>{b.nights}</td>
                  <td style={{ fontSize: 12 }}>
                    {b.rooms.map((r) => r.name + (r.qty > 1 ? " ×" + r.qty : "")).join(", ")}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmt(b.total)}</td>
                  <td
                    style={{
                      fontWeight: 500,
                      color: b.balance > 0 ? "var(--amb)" : "var(--grn)",
                    }}
                  >
                    {b.balance > 0 ? fmt(b.balance) : "Paid ✓"}
                  </td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{b.rex}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
