"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, sevenDaysFrom, todayStr, weekRange } from "@/lib/utils";

type RevFilter = "today" | "week" | "month";

export default function DashboardPage() {
  const router = useRouter();
  const { bookings, revenueEntries, currentUser, rooms, roomInventory } = useApp();

  // Categories + totals are derived live from the master so a Blocked room drops the total.
  const roomCategories = useMemo(() => {
    return rooms.map((r) => {
      const total = roomInventory.filter(
        (inv) => inv.cat === r.id && inv.active
      ).length;
      return { name: r.name, cats: [r.id], total };
    });
  }, [rooms, roomInventory]);

  const [today, setToday] = useState("");
  const [revFilter, setRevFilter] = useState<RevFilter>("week");

  useEffect(() => {
    setToday(todayStr());
  }, []);

  // ───── Revenue ─────
  const revData = useMemo(() => {
    if (!today) return { total: 0, count: 0, label: "" };
    const entries = revenueEntries.filter((e) => e.amount > 0);
    let filtered = entries;
    let label = "";
    if (revFilter === "today") {
      filtered = entries.filter((e) => e.date === today);
      label = "Today";
    } else if (revFilter === "week") {
      const { start, end } = weekRange(today);
      filtered = entries.filter((e) => e.date >= start && e.date <= end);
      label = "This Week";
    } else {
      const month = today.slice(0, 7);
      filtered = entries.filter((e) => e.date.startsWith(month));
      label = "This Month";
    }
    return {
      total: filtered.reduce((s, e) => s + e.amount, 0),
      count: filtered.length,
      label,
    };
  }, [revenueEntries, revFilter, today]);

  // ───── Payment Pending ─────
  const pendingBookings = useMemo(
    () => bookings.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance),
    [bookings]
  );

  // ───── Room Status (next 7 days) ─────
  const roomDates = useMemo(() => {
    if (!today) return [];
    return sevenDaysFrom(today);
  }, [today]);

  const roomStatus = useMemo(() => {
    return roomCategories.map((cat) => {
      const cells = roomDates.map((d) => {
        let booked = 0;
        let tentative = 0;
        bookings.forEach((b) => {
          if (b.checkin <= d && d < b.checkout) {
            const qtyByCat = new Map<string, number>();
            b.pricingRows.forEach((r) => {
              if (!cat.cats.includes(r.roomId)) return;
              const prev = qtyByCat.get(r.roomId) || 0;
              qtyByCat.set(r.roomId, Math.max(prev, r.numRooms));
            });
            const qty = Array.from(qtyByCat.values()).reduce((s, n) => s + n, 0);
            if (qty <= 0) return;
            if (b.status === "Confirmed" || b.status === "Completed") booked += qty;
            else if (b.status === "Tentative") tentative += qty;
          }
        });
        const available = Math.max(0, cat.total - booked - tentative);
        return { date: d, booked, tentative, available };
      });
      return { ...cat, cells };
    });
  }, [bookings, roomDates, roomCategories]);

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Hello, {currentUser}</h2>
          <p>Quick overview of revenue, payments and room availability</p>
        </div>
      </div>

      {/* ───────── Revenue ───────── */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>Revenue</h3>
          <div className="filter-bar" style={{ marginLeft: "auto", marginBottom: 0 }}>
            {([
              { id: "today", label: "Today" },
              { id: "week", label: "This Week" },
              { id: "month", label: "This Month" },
            ] as { id: RevFilter; label: string }[]).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-btn${revFilter === f.id ? " on" : ""}`}
                onClick={() => setRevFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div
            className="stat-val"
            style={{ fontSize: 38 }}
          >
            {fmt(revData.total)}
          </div>
          <div className="stat-sub" style={{ marginTop: 8 }}>
            {revData.label} · {revData.count} payment event{revData.count !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* ───────── Payment Pending ───────── */}
      <div className="tbl-wrap" style={{ marginBottom: 18 }}>
        <div className="tbl-hd">
          <h3>Payment Pending</h3>
          <span className="tbl-hd-r" style={{ fontSize: 12, color: "var(--t3)" }}>
            {pendingBookings.length} booking{pendingBookings.length !== 1 ? "s" : ""}
          </span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Guest Name</th>
              <th style={{ textAlign: "right" }}>Amount Pending</th>
            </tr>
          </thead>
          <tbody>
            {pendingBookings.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <div className="empty-state">
                    <h3>All bookings paid up</h3>
                    <p>No pending balances right now</p>
                  </div>
                </td>
              </tr>
            ) : (
              pendingBookings.map((b) => (
                <tr key={b.id} onClick={() => router.push(`/bookings/${b.id}`)}>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-outfit), Outfit, sans-serif",
                        color: "var(--t3)",
                        fontWeight: 700,
                      }}
                    >
                      {b.id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--t1)" }}>{b.guest}</div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>{b.mobile}</div>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--amb)" }}>
                    {fmt(b.balance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ───────── Room Status ───────── */}
      <div className="tbl-wrap">
        <div className="tbl-hd">
          <h3>Room Status</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Room Category</th>
              {roomDates.map((d) => {
                const dt = new Date(d);
                const wk = dt.toLocaleDateString("en-IN", { weekday: "short" });
                const dm = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
                return (
                  <th key={d} style={{ textAlign: "center" }}>
                    <div>{wk}</div>
                    <div style={{ fontSize: 9, color: "var(--t4)", fontWeight: 500, marginTop: 2 }}>{dm}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {roomStatus.map((row) => (
              <tr key={row.name} style={{ cursor: "default" }}>
                <td>
                  <div style={{ fontWeight: 500, color: "var(--t1)" }}>{row.name}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>{row.total} total</div>
                </td>
                {row.cells.map((c) => (
                  <td key={c.date} style={{ textAlign: "center" }}>
                    <div className="rs-cell" title={`Booked / Tentative / Available`}>
                      <span className="rs-b">{c.booked}</span>
                      <span className="rs-sep">/</span>
                      <span className="rs-t">{c.tentative}</span>
                      <span className="rs-sep">/</span>
                      <span className="rs-a">{c.available}</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--bd)",
            background: "var(--surf2)",
            fontSize: 11,
            color: "var(--t3)",
            display: "flex",
            gap: 18,
          }}
        >
          <span>
            <strong style={{ color: "var(--amb)" }}>Booked</strong> / <strong style={{ color: "var(--t3)" }}>Tentative</strong> / <strong style={{ color: "var(--grn)" }}>Available</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
