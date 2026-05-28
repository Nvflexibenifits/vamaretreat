"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN, todayStr } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import type { BookingStatus } from "@/types";

const FILTERS: ("All" | BookingStatus)[] = [
  "All",
  "Enquiry",
  "Tentative",
  "Confirmed",
];

export default function BookingsPage() {
  const { bookings, currentRole } = useApp();
  const router = useRouter();

  if (currentRole === "Front Office") {
    return (
      <div className="view">
        <div className="pg-hd"><div><h2>Access Denied</h2><p>Booking list is not available for your role.</p></div></div>
      </div>
    );
  }
  const [statusFilter, setStatusFilter] = useState<"All" | BookingStatus>("All");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(todayStr());
  }, []);

  const todayCheckins = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.checkin === today &&
          (b.status === "Confirmed" || b.status === "Tentative")
      ),
    [bookings, today]
  );

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
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStatusFilter("All");
              setSearch("");
              setFrom(today);
              setTo(today);
            }}
            title="Filter to today's check-ins"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--t3)",
                textTransform: "uppercase",
                letterSpacing: ".4px",
              }}
            >
              Today's Check-ins
            </span>
            <span
              style={{
                fontFamily: "var(--font-outfit), Outfit, sans-serif",
                fontSize: 16,
                fontWeight: 800,
                color:
                  todayCheckins.length > 0 ? "var(--acc)" : "var(--t2)",
              }}
            >
              {todayCheckins.length}
            </span>
          </button>
          <Link href="/bookings/new" className="btn btn-primary">
            New Booking
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
              <th>Check-out</th>
              <th>Nights</th>
              <th>Rooms</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>REX</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={13}>
                  <div className="empty-state">
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
                  <td>{fmtIN(b.checkin)}</td>
                  <td>{fmtIN(b.checkout)}</td>
                  <td>{b.nights}</td>
                  <td style={{ fontSize: 12 }}>
                    {(() => {
                      const m = new Map<string, number>();
                      b.pricingRows.forEach((r) => {
                        const prev = m.get(r.roomName) || 0;
                        m.set(r.roomName, Math.max(prev, r.numRooms));
                      });
                      return Array.from(m.entries())
                        .map(([name, qty]) => name + (qty > 1 ? " ×" + qty : ""))
                        .join(", ") || "—";
                    })()}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmt(b.grandTotal)}</td>
                  <td style={{ fontWeight: 500, color: "var(--grn)" }}>
                    {fmt(b.grandTotal - b.balance)}
                  </td>
                  <td
                    style={{
                      fontWeight: 500,
                      color: b.balance > 0 ? "var(--amb)" : "var(--grn)",
                    }}
                  >
                    {b.balance > 0 ? fmt(b.balance) : "Paid"}
                  </td>
                  <td>
                    <StatusBadge status={b.status} />
                  </td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{b.rex}</td>
                  <td
                    style={{ textAlign: "right", whiteSpace: "nowrap" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      href={`/bookings/${b.id}`}
                      className="btn btn-ghost btn-xs"
                      style={{ marginRight: 6 }}
                    >
                      View
                    </Link>
                    {b.status !== "Completed" &&
                      b.status !== "Lost" &&
                      b.status !== "Cancelled" && (
                        <Link
                          href={`/bookings/${b.id}/edit`}
                          className="btn btn-ghost btn-xs"
                        >
                          Edit
                        </Link>
                      )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
