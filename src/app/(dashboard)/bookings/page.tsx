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

  const data = bookings
    .filter((b) => {
      // Lost and Completed bookings are excluded from this list entirely
      if (b.status === "Lost" || b.status === "Completed") return false;
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
    })
    // Earliest check-in first; same-day check-ins tie-break on booking id
    .sort((a, b) => a.checkin.localeCompare(b.checkin) || a.id.localeCompare(b.id));

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>B2C Bookings</h2>
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
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px" }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".4px" }}>
              Today's Check-ins
            </span>
            <span style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 16, fontWeight: 800, color: todayCheckins.length > 0 ? "var(--acc)" : "var(--t2)" }}>
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
        <div className="date-filter-wrap">
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn btn-ghost btn-xs" onClick={() => { setFrom(""); setTo(""); }}>
            Clear
          </button>
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
              <th>Amount Due</th>
              <th>Amount Received</th>
              <th>Balance Amount</th>
              <th>Status</th>
              <th>REX</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <div className="empty-state">
                    <h3>No bookings found</h3>
                    <p>Try adjusting your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((b) => {
                // Refund still owed to the guest on a refund-mode cancellation
                const refundDue =
                  b.status === "Cancelled" && b.cancellationDetails?.resolution === "refund"
                    ? Math.max(
                        0,
                        (b.cancellationDetails.refundAmount ?? 0) -
                          (b.cancellationDetails.refundPayouts ?? []).reduce((s, p) => s + p.amount, 0)
                      )
                    : 0;
                const pending = b.status === "Cancelled" || b.status === "Lost" ? 0 : b.balance;
                // Refund cancellations owe nothing beyond what the hotel
                // retains — mirror the revenue register's Total column. A
                // waive-off writes the unpaid balance out of the due amount,
                // and OTA deductions never arrive, so they come off too.
                const dedTotal = (b.deductions ?? []).reduce((s, d) => s + d.amount + d.gst, 0);
                const amountDue =
                  b.status === "Cancelled" && b.cancellationDetails?.resolution === "refund"
                    ? (b.cancellationDetails.cancellationCharge ?? 0) +
                      (b.cancellationDetails.creditNoteAmount ?? 0)
                    : b.grandTotal - (b.waiveOff?.totalGross ?? 0) - dedTotal;
                // Money actually received — never derived from balance, which
                // can settle without money (waive-offs).
                const received =
                  (b.payments ?? []).reduce((s, p) => s + p.amount, 0) || b.advance;
                return (
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
                    <td>{b.checkin === b.checkout ? "Dayout" : b.nights}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(amountDue)}</td>
                    <td style={{ fontWeight: 500, color: "var(--grn)" }}>{fmt(received)}</td>
                    <td
                      style={{
                        fontWeight: 500,
                        color:
                          pending >= 1
                            ? "var(--amb)"
                            : refundDue > 0
                            ? "var(--pur)"
                            : "var(--t3)",
                      }}
                      title={
                        pending >= 1
                          ? "Amount pending from guest"
                          : refundDue > 0
                          ? "Refund due to guest"
                          : "Settled"
                      }
                    >
                      {pending >= 1 ? fmt(pending) : refundDue > 0 ? `−${fmt(refundDue)}` : "0"}
                    </td>
                    <td><StatusBadge status={b.status} /></td>
                    <td style={{ fontSize: 11, color: "var(--t3)" }}>{b.rex}</td>
                    <td
                      style={{ textAlign: "right", whiteSpace: "nowrap" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/bookings/${b.id}`} className="btn btn-ghost btn-xs">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
