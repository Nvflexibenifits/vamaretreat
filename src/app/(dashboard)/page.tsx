"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN, sevenDaysFrom, todayStr, weekRange } from "@/lib/utils";

type RevFilter = "today" | "week" | "month";

export default function DashboardPage() {
  const router = useRouter();
  const { bookings, revenueEntries, currentUser, currentRole, rooms, roomInventory } = useApp();
  const isFrontOffice = currentRole === "Front Office";

  const roomCategories = useMemo(() => {
    return rooms.map((r) => {
      const total = roomInventory.filter(
        (inv) => inv.cat === r.id && inv.active
      ).length;
      return { name: r.name, cats: [r.id], total };
    });
  }, [rooms, roomInventory]);

  const [today, setToday] = useState("");
  const [revFilter, setRevFilter] = useState<RevFilter>("month");
  const [pendingOpen, setPendingOpen] = useState(false);

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
    () =>
      bookings
        .filter((b) => b.balance > 0 && b.status !== "Cancelled" && b.status !== "Lost")
        .sort((a, b) => a.checkin.localeCompare(b.checkin)),
    [bookings]
  );

  const totalPending = useMemo(
    () => pendingBookings.reduce((s, b) => s + b.balance, 0),
    [pendingBookings]
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

  // ───── Front Office: Room Summary for today ─────
  const roomSummaryToday = useMemo(() => {
    if (!today) return [];
    const getRoomCount = (b: (typeof bookings)[0], catId: string): number => {
      const qty = new Map<string, number>();
      b.pricingRows.forEach((r) => {
        if (r.roomId !== catId) return;
        qty.set(r.roomId, Math.max(qty.get(r.roomId) ?? 0, r.numRooms));
      });
      return Array.from(qty.values()).reduce((s, n) => s + n, 0);
    };
    return rooms
      .map((r) => {
        let rollOver = 0;
        let newCheckin = 0;
        bookings.forEach((b) => {
          if (b.status !== "Confirmed" && b.status !== "Completed") return;
          const qty = getRoomCount(b, r.id);
          if (qty === 0) return;
          if (b.checkin < today && b.checkout > today) rollOver += qty;
          else if (b.checkin === today && b.checkout > today) newCheckin += qty;
        });
        return { category: r.name, rollOver, newCheckin, total: rollOver + newCheckin };
      })
      .filter((row) => row.total > 0);
  }, [rooms, bookings, today]);

  // ───── Front Office: Guest Pax Count for today ─────
  const guestPaxToday = useMemo(() => {
    if (!today) return [];
    const isActive = (b: (typeof bookings)[0]) =>
      (b.status === "Confirmed" || b.status === "Completed") &&
      b.checkin <= today && b.checkout > today;
    const isRollOver = (b: (typeof bookings)[0]) => b.checkin < today;
    const isNew = (b: (typeof bookings)[0]) => b.checkin === today;
    const sum = (arr: (typeof bookings), fn: (b: (typeof bookings)[0]) => number) =>
      arr.reduce((s, b) => s + fn(b), 0);

    const active = bookings.filter(isActive);
    const rollOverBkgs = active.filter(isRollOver);
    const newBkgs = active.filter(isNew);
    const mealBkgs = active.filter((b) => b.mealOn);
    const driverMealBkgs = active.filter((b) => b.driverMealOn);

    return [
      {
        label: "Adults",
        rollOver: sum(rollOverBkgs, (b) => b.adults),
        newGuests: sum(newBkgs, (b) => b.adults),
        meals: sum(mealBkgs, (b) => b.adults),
        total: sum(active, (b) => b.adults),
      },
      {
        label: "Sr. Citizens",
        rollOver: sum(rollOverBkgs, (b) => b.seniors),
        newGuests: sum(newBkgs, (b) => b.seniors),
        meals: sum(mealBkgs, (b) => b.seniors),
        total: sum(active, (b) => b.seniors),
      },
      {
        label: "Kids",
        rollOver: sum(rollOverBkgs, (b) => b.kidsAbove10 + b.kids6to10 + b.kids2to6 + b.infantsBelow2),
        newGuests: sum(newBkgs, (b) => b.kidsAbove10 + b.kids6to10 + b.kids2to6 + b.infantsBelow2),
        meals: sum(mealBkgs, (b) => b.kidsAbove10 + b.kids6to10 + b.kids2to6 + b.infantsBelow2),
        total: sum(active, (b) => b.kidsAbove10 + b.kids6to10 + b.kids2to6 + b.infantsBelow2),
      },
      {
        label: "Pets",
        rollOver: sum(rollOverBkgs, (b) => b.pets),
        newGuests: sum(newBkgs, (b) => b.pets),
        meals: 0,
        total: sum(active, (b) => b.pets),
      },
      {
        label: "Driver",
        rollOver: sum(rollOverBkgs, (b) => b.driverCount ?? 0),
        newGuests: sum(newBkgs, (b) => b.driverCount ?? 0),
        meals: sum(driverMealBkgs, (b) => b.driverCount ?? 0),
        total: sum(active, (b) => b.driverCount ?? 0),
      },
    ].filter((row) => row.total > 0);
  }, [bookings, today]);

  // ───── Front Office View ─────
  if (isFrontOffice) {
    const todayLabel = today
      ? new Date(today + "T00:00:00").toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "";

    return (
      <div className="view">
        <div className="pg-hd">
          <div>
            <h2>Hello, {currentUser}</h2>
            <p>Today&apos;s occupancy and guest pax overview &mdash; {todayLabel}</p>
          </div>
        </div>

        {/* Room Summary */}
        <div className="tbl-wrap" style={{ marginBottom: 16 }}>
          <div className="tbl-hd">
            <h3>Room Summary &mdash; Today</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Room Category</th>
                <th style={{ textAlign: "center" }}>Roll Over Rooms</th>
                <th style={{ textAlign: "center" }}>New Check-ins</th>
                <th style={{ textAlign: "center" }}>Total Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {roomSummaryToday.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-state">
                      <h3>No occupied rooms today</h3>
                      <p>No confirmed or completed bookings are active today</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {roomSummaryToday.map((row) => (
                    <tr key={row.category}>
                      <td style={{ fontWeight: 500, color: "var(--t1)" }}>{row.category}</td>
                      <td style={{ textAlign: "center" }}>
                        {row.rollOver > 0 ? (
                          <span style={{ fontWeight: 600, color: "var(--t1)" }}>{row.rollOver}</span>
                        ) : (
                          <span style={{ color: "var(--t4)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {row.newCheckin > 0 ? (
                          <span style={{ fontWeight: 600, color: "var(--grn)" }}>{row.newCheckin}</span>
                        ) : (
                          <span style={{ color: "var(--t4)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 700, color: "var(--t1)" }}>{row.total}</span>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                    <td style={{ color: "var(--t1)" }}>Total</td>
                    <td style={{ textAlign: "center", color: "var(--t1)" }}>
                      {roomSummaryToday.reduce((s, r) => s + r.rollOver, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--grn)" }}>
                      {roomSummaryToday.reduce((s, r) => s + r.newCheckin, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--t1)" }}>
                      {roomSummaryToday.reduce((s, r) => s + r.total, 0)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Guest Pax Count */}
        <div className="tbl-wrap">
          <div className="tbl-hd">
            <h3>Guest Pax Count &mdash; Today</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Guest Category</th>
                <th style={{ textAlign: "center" }}>Roll Over Guests</th>
                <th style={{ textAlign: "center" }}>New Guests</th>
                <th style={{ textAlign: "center" }}>Meals</th>
                <th style={{ textAlign: "center" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {guestPaxToday.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <h3>No guests today</h3>
                      <p>No confirmed or completed bookings are active today</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {guestPaxToday.map((row) => (
                    <tr key={row.label}>
                      <td style={{ fontWeight: 500, color: "var(--t1)" }}>{row.label}</td>
                      <td style={{ textAlign: "center" }}>
                        {row.rollOver > 0 ? (
                          <span style={{ fontWeight: 600, color: "var(--t1)" }}>{row.rollOver}</span>
                        ) : (
                          <span style={{ color: "var(--t4)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {row.newGuests > 0 ? (
                          <span style={{ fontWeight: 600, color: "var(--grn)" }}>{row.newGuests}</span>
                        ) : (
                          <span style={{ color: "var(--t4)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {row.label === "Pets" ? (
                          <span style={{ color: "var(--t4)" }}>—</span>
                        ) : row.meals > 0 ? (
                          <span style={{ fontWeight: 600, color: "var(--amb)" }}>{row.meals}</span>
                        ) : (
                          <span style={{ color: "var(--t4)" }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 700, color: "var(--t1)" }}>{row.total}</span>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                    <td style={{ color: "var(--t1)" }}>Total</td>
                    <td style={{ textAlign: "center", color: "var(--t1)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.rollOver, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--grn)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.newGuests, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--amb)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.meals, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--t1)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.total, 0)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Hello, {currentUser}</h2>
        </div>
        <a href="/bookings/new" className="btn btn-accent btn-sm">New Booking</a>
      </div>

      {/* ───────── Top summary cards ───────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Revenue card */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
              Revenue
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
              {(["today", "week", "month"] as RevFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`filter-btn${revFilter === f ? " on" : ""}`}
                  style={{ fontSize: 11, padding: "3px 8px" }}
                  onClick={() => setRevFilter(f)}
                >
                  {f === "today" ? "Today" : f === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
          </div>
          <div className="stat-val" style={{ fontSize: 34 }}>{fmt(revData.total)}</div>
          <div className="stat-sub" style={{ marginTop: 6 }}>
            {revData.label} · {revData.count} payment{revData.count !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Payment Pending summary card */}
        <div className="card">
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
              Payment Pending
            </span>
          </div>
          <div className="stat-val" style={{ fontSize: 34, color: "var(--amb)" }}>
            {fmt(totalPending)}
          </div>
          <div className="stat-sub" style={{ marginTop: 6 }}>
            {pendingBookings.length} booking{pendingBookings.length !== 1 ? "s" : ""} with outstanding balance
          </div>
        </div>

      </div>

      {/* ───────── Payment Pending list (collapsible) ───────── */}
      <div className="tbl-wrap" style={{ marginBottom: 16 }}>
        <div
          className="tbl-hd"
          style={{ cursor: "pointer", userSelect: "none" }}
          onClick={() => setPendingOpen((v) => !v)}
        >
          <h3>Payment Pending List</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            {pendingBookings.length > 0 && (
              <span
                className="badge"
                style={{ background: "var(--amb-bg)", color: "var(--amb)", fontWeight: 700 }}
              >
                {pendingBookings.length}
              </span>
            )}
            <span
              style={{
                fontSize: 18,
                color: "var(--t3)",
                lineHeight: 1,
                transform: pendingOpen ? "rotate(180deg)" : "none",
                transition: "transform .2s",
                display: "inline-block",
              }}
            >
              &#8964;
            </span>
          </div>
        </div>

        {pendingOpen && (
          <table>
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Guest Name</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th style={{ textAlign: "right", width: 130, whiteSpace: "nowrap" }}>Amount Due</th>
                <th style={{ textAlign: "right", width: 140, whiteSpace: "nowrap" }}>Amount Received</th>
                <th style={{ textAlign: "right", width: 140, whiteSpace: "nowrap" }}>Balance Amount</th>
                <th style={{ textAlign: "right", width: 100, whiteSpace: "nowrap" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingBookings.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <h3>All bookings paid up</h3>
                      <p>No pending balances right now</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span style={{ fontSize: 11, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--t3)", fontWeight: 700 }}>
                        {b.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--t1)" }}>{b.guest}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{b.mobile}</div>
                    </td>
                    <td>{fmtIN(b.checkin)}</td>
                    <td>{fmtIN(b.checkout)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(b.grandTotal)}</td>
                    <td style={{ textAlign: "right", color: "var(--grn)" }}>{fmt(b.advance)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--amb)" }}>{fmt(b.balance)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ marginRight: 4 }}
                        onClick={() => router.push(`/bookings/${b.id}`)}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => router.push(`/bookings/${b.id}/edit`)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ───────── Weekly Room Status ───────── */}
      <div className="tbl-wrap">
        <div className="tbl-hd">
          <h3>Weekly Room Status</h3>
          <div style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <strong style={{ color: "var(--amb)" }}>Booked</strong>
            {" / "}
            <strong style={{ color: "var(--t3)" }}>Tentative</strong>
            {" / "}
            <strong style={{ color: "var(--grn)" }}>Available</strong>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Room Category</th>
              {roomDates.map((d) => {
                const dt = new Date(d + "T00:00:00");
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
                    <div className="rs-cell" title="Booked / Tentative / Available">
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
      </div>
    </div>
  );
}
