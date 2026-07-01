"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN, dayName, getBookingPricingRows } from "@/lib/utils";

export default function RevenuePage() {
  const { bookings, currentRole } = useApp();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  if (currentRole === "Front Office") {
    return (
      <div className="view">
        <div className="pg-hd">
          <div><h2>Access Denied</h2><p>Revenue is not available for your role.</p></div>
        </div>
      </div>
    );
  }

  // Only Confirmed + Cancelled count as revenue
  const revenueBookings = bookings.filter(
    (b) => b.status === "Confirmed" || b.status === "Cancelled"
  );

  // Summary card data (global, not affected by filters)
  const thisMonth = new Date().toISOString().slice(0, 7);
  const thisMonthBookings = revenueBookings.filter((b) => b.checkin.startsWith(thisMonth));
  const revenueThisMonth = thisMonthBookings.reduce((s, b) => s + b.grandTotal, 0);

  const pendingBookings = bookings.filter((b) => b.status === "Confirmed" && b.balance > 0);
  const pendingPayments = pendingBookings.reduce((s, b) => s + b.balance, 0);

  const cancelledBookings = bookings.filter((b) => b.status === "Cancelled");
  const refundsPending = cancelledBookings.reduce((s, b) => s + b.advance, 0);

  // Table filter: search + date range on checkin
  const filtered = revenueBookings.filter((b) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!b.guest.toLowerCase().includes(q) && !b.id.toLowerCase().includes(q)) return false;
    }
    if (dateFrom && b.checkin < dateFrom) return false;
    if (dateTo && b.checkin > dateTo) return false;
    return true;
  });

  // Footer totals from filtered rows
  const totals = filtered.reduce(
    (acc, b) => {
      const rows = getBookingPricingRows(b);
      const roomNet = rows.reduce((s, r) => s + r.netCharges, 0);
      const roomGst = rows.reduce((s, r) => s + r.gstAmt, 0);
      const mealNet = b.mealTotal + b.petTotal + (b.driverMealTotal ?? 0);
      const mealGst = b.mealGst + b.petGst + (b.driverMealGst ?? 0);
      const other = Math.max(0, b.grandTotal - b.totalRoomCharges - b.totalMealCharges);
      return {
        roomNet: acc.roomNet + roomNet,
        roomGst: acc.roomGst + roomGst,
        mealNet: acc.mealNet + mealNet,
        mealGst: acc.mealGst + mealGst,
        other: acc.other + other,
        grandTotal: acc.grandTotal + b.grandTotal,
        paid: acc.paid + b.advance,
        balance: acc.balance + b.balance,
      };
    },
    { roomNet: 0, roomGst: 0, mealNet: 0, mealGst: 0, other: 0, grandTotal: 0, paid: 0, balance: 0 }
  );

  const hasFilter = search.trim() || dateFrom || dateTo;

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Revenue</h2>
          <p>Confirmed and cancelled bookings only</p>
        </div>
      </div>

      {/* 3-column summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Revenue This Month
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--sb)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(revenueThisMonth)}
          </div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>
            {thisMonthBookings.length} booking{thisMonthBookings.length !== 1 ? "s" : ""} checking in this month
          </div>
        </div>

        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "16px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Pending Payments
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--amb)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(pendingPayments)}
          </div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>
            {pendingBookings.length} confirmed booking{pendingBookings.length !== 1 ? "s" : ""} with balance due
          </div>
        </div>

        <div style={{
          background: refundsPending > 0 ? "var(--red-lt, #fff5f5)" : "var(--surf2)",
          border: `1px solid ${refundsPending > 0 ? "var(--red)" : "var(--bd)"}`,
          borderRadius: "var(--r4)",
          padding: "16px 20px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: refundsPending > 0 ? "var(--red)" : "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Refunds Pending
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: refundsPending > 0 ? "var(--red)" : "var(--t2)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(refundsPending)}
          </div>
          <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>
            {cancelledBookings.length} cancelled booking{cancelledBookings.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Search by guest name or booking ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: "1 1 200px",
            minWidth: 180,
            maxWidth: 320,
            padding: "7px 12px",
            border: "1px solid var(--bd)",
            borderRadius: "var(--r3)",
            fontSize: 13,
            background: "var(--surf)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--t3)", whiteSpace: "nowrap" }}>Check-in from</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              padding: "7px 10px",
              border: "1px solid var(--bd)",
              borderRadius: "var(--r3)",
              fontSize: 13,
              background: "var(--surf)",
              outline: "none",
              color: "var(--t1)",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, color: "var(--t3)", whiteSpace: "nowrap" }}>to</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              padding: "7px 10px",
              border: "1px solid var(--bd)",
              borderRadius: "var(--r3)",
              fontSize: 13,
              background: "var(--surf)",
              outline: "none",
              color: "var(--t1)",
            }}
          />
        </div>
        {hasFilter && (
          <button
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, whiteSpace: "nowrap" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Revenue Table */}
      <div className="tbl-wrap">
        <div className="tbl-hd">
          <h3>Revenue Table</h3>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>
            {filtered.length} booking{filtered.length !== 1 ? "s" : ""}{hasFilter ? " (filtered)" : ""}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 48, textAlign: "center" }}>Sr.No.</th>
                <th style={{ whiteSpace: "nowrap" }}>B.ID</th>
                <th>Guest Name</th>
                <th style={{ whiteSpace: "nowrap" }}>Check-in</th>
                <th style={{ whiteSpace: "nowrap" }}>Check-out</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Room Charges</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Meal Charges</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Other Charges</th>
                <th style={{ textAlign: "center", width: 70 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state" style={{ padding: 32 }}>
                      <p>{hasFilter ? "No bookings match the current filters." : "No confirmed or cancelled bookings yet."}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((b, i) => {
                  const rows = getBookingPricingRows(b);
                  const roomNet = rows.reduce((s, r) => s + r.netCharges, 0);
                  const mealNet = b.mealTotal + b.petTotal + (b.driverMealTotal ?? 0);
                  const other = Math.max(0, b.grandTotal - b.totalRoomCharges - b.totalMealCharges);
                  return (
                    <tr key={b.id}>
                      <td style={{ textAlign: "center", color: "var(--t3)", fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <span style={{ fontSize: 11, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--t2)", fontWeight: 700 }}>
                          {b.id}
                        </span>
                        {b.status === "Cancelled" && (
                          <span className="badge bd-lost" style={{ marginLeft: 6, fontSize: 9 }}>Cancelled</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 500, color: "var(--t1)" }}>{b.guest}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ lineHeight: 1.3 }}>
                          <div>{fmtIN(b.checkin)}</div>
                          <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{dayName(b.checkin)}</div>
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ lineHeight: 1.3 }}>
                          <div>{fmtIN(b.checkout)}</div>
                          <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500 }}>{dayName(b.checkout)}</div>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 500 }}>{fmt(roomNet)}</td>
                      <td style={{ textAlign: "right" }}>{mealNet > 0 ? fmt(mealNet) : "—"}</td>
                      <td style={{ textAlign: "right" }}>{other > 0 ? fmt(other) : "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        <Link href={`/bookings/${b.id}`} className="btn btn-ghost btn-xs">View</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer totals */}
        {filtered.length > 0 && (
          <div style={{ borderTop: "2px solid var(--bd)", display: "flex", justifyContent: "flex-end", padding: "16px 12px" }}>
            <table style={{ minWidth: 340 }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 16px 4px 0", color: "var(--t2)", fontSize: 13 }}>Total Charges (Room + Meal + Other)</td>
                  <td style={{ textAlign: "right", fontWeight: 600, fontSize: 13 }}>{fmt(totals.roomNet + totals.mealNet + totals.other)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 16px 4px 0", color: "var(--t3)", fontSize: 12 }}>GST on Room Charges</td>
                  <td style={{ textAlign: "right", color: "var(--t3)", fontSize: 12 }}>+ {fmt(totals.roomGst)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 16px 4px 0", color: "var(--t3)", fontSize: 12 }}>GST on Meal Charges</td>
                  <td style={{ textAlign: "right", color: "var(--t3)", fontSize: 12 }}>+ {fmt(totals.mealGst)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 16px 4px 0", color: "var(--t3)", fontSize: 12 }}>GST on Other Charges</td>
                  <td style={{ textAlign: "right", color: "var(--t3)", fontSize: 12 }}>—</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--bd)" }}>
                  <td style={{ padding: "8px 16px 4px 0", fontWeight: 700, color: "var(--t1)", fontSize: 14 }}>Grand Total</td>
                  <td style={{ textAlign: "right", fontWeight: 800, fontSize: 18, color: "var(--sb)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>{fmt(totals.grandTotal)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 16px 4px 0", color: "var(--t2)", fontSize: 13 }}>Amount Paid</td>
                  <td style={{ textAlign: "right", fontWeight: 600, color: "var(--grn)", fontSize: 13 }}>{fmt(totals.paid)}</td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 16px 4px 0", color: "var(--t2)", fontSize: 13 }}>Balance Amount</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: totals.balance > 0 ? "var(--amb)" : "var(--grn)", fontSize: 14 }}>
                    {totals.balance > 0 ? fmt(totals.balance) : "Fully Paid"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
