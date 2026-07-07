"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { addDays, fmt, fmtIN, nightsBetween, sevenDaysFrom, todayStr, weekRange } from "@/lib/utils";

type RevFilter = "month";

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
  const [foFilter, setFoFilter] = useState<"today" | "tomorrow" | "custom">("today");
  const [foCustomDate, setFoCustomDate] = useState("");
  // Weekly Room Status: start date of the displayed week ("" = week starting today)
  const [weekStart, setWeekStart] = useState("");

  useEffect(() => {
    setToday(todayStr());
  }, []);

  // ───── Revenue ─────
  const revData = useMemo(() => {
    if (!today) return { total: 0, count: 0, label: "" };
    const entries = revenueEntries.filter((e) => e.amount > 0);
    const month = today.slice(0, 7);
    const filtered = entries.filter((e) => e.date.startsWith(month));
    return {
      total: filtered.reduce((s, e) => s + e.amount, 0),
      count: filtered.length,
      label: "This Month",
    };
  }, [revenueEntries, today]);

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

  // ───── Room Status (7 days from the selected week start) ─────
  const roomDates = useMemo(() => {
    const anchor = weekStart || today;
    if (!anchor) return [];
    return sevenDaysFrom(anchor);
  }, [today, weekStart]);

  const roomStatus = useMemo(() => {
    return roomCategories.map((cat) => {
      const cells = roomDates.map((d) => {
        let booked = 0;
        let tentative = 0;
        bookings.forEach((b) => {
          if (b.checkin <= d && d < b.checkout) {
            const qtyByCat = new Map<string, number>();
            b.segments
              .filter((seg) => seg.checkin <= d && d < seg.checkout)
              .forEach((seg) => {
                seg.rooms.forEach((r) => {
                  if (!cat.cats.includes(r.roomId)) return;
                  const prev = qtyByCat.get(r.roomId) || 0;
                  qtyByCat.set(r.roomId, Math.max(prev, r.numRooms));
                });
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
      let qty = 0;
      b.segments
        .filter((seg) => seg.checkin <= today && today < seg.checkout)
        .forEach((seg) => {
          seg.rooms
            .filter((r) => r.roomId === catId)
            .forEach((r) => { qty = Math.max(qty, r.numRooms); });
        });
      return qty;
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

  // ───── Front Office: daily report filter date ─────
  const foDate = useMemo(() => {
    if (!today) return "";
    if (foFilter === "today") return today;
    if (foFilter === "tomorrow") return addDays(today, 1);
    return foCustomDate || today;
  }, [today, foFilter, foCustomDate]);

  const foDateLabel = useMemo(() => {
    if (!foDate) return "";
    return new Date(foDate + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }, [foDate]);

  // ───── Front Office: Check-ins / Stayovers / Check-outs ─────
  const foCheckIns = useMemo(() => {
    if (!foDate) return [];
    return bookings.filter(
      (b) => b.checkin === foDate &&
        (b.status === "Confirmed" || b.status === "Tentative")
    );
  }, [bookings, foDate]);

  const foStayovers = useMemo(() => {
    if (!foDate) return [];
    return bookings.filter(
      (b) => b.checkin < foDate && b.checkout > foDate &&
        (b.status === "Confirmed" || b.status === "Tentative" || b.status === "Completed")
    );
  }, [bookings, foDate]);

  const foCheckOuts = useMemo(() => {
    if (!foDate) return [];
    return bookings.filter(
      (b) => b.checkout === foDate &&
        (b.status === "Confirmed" || b.status === "Tentative" || b.status === "Completed")
    );
  }, [bookings, foDate]);

  // ───── Front Office View ─────
  if (isFrontOffice) {
    // helper to compute pax totals for a booking list
    const paxTotals = (list: typeof bookings) => ({
      adults: list.reduce((s, b) => s + b.adults, 0),
      seniors: list.reduce((s, b) => s + b.seniors, 0),
      kGt14: list.reduce((s, b) => s + b.kidsAbove10, 0),
      kLt14: list.reduce((s, b) => s + (b.kids6to10 + b.kids2to6 + b.infantsBelow2), 0),
      pets: list.reduce((s, b) => s + b.pets, 0),
    });

    const soTotals = paxTotals(foStayovers);

    const foTblHead = (
      <tr>
        <th style={{ width: 36, textAlign: "center" }}>Sl.</th>
        <th>Guest Name</th>
        <th style={{ textAlign: "center", width: 48 }}>Day</th>
        <th>Room No's</th>
        <th style={{ textAlign: "center", width: 44 }}>A</th>
        <th style={{ textAlign: "center", width: 52 }}>Sr.Ct</th>
        <th style={{ textAlign: "center", width: 52 }}>K&gt;14</th>
        <th style={{ textAlign: "center", width: 52 }}>K&lt;14</th>
        <th style={{ textAlign: "center", width: 48 }}>Pets</th>
        <th style={{ textAlign: "center", width: 60 }}>Meals</th>
        <th style={{ textAlign: "right", width: 110, whiteSpace: "nowrap" }}>Pmt Pending</th>
        <th style={{ textAlign: "center", width: 72 }}>Actions</th>
      </tr>
    );

    const foRow = (b: typeof bookings[0], day: number, idx: number) => (
      <tr key={b.id}>
        <td style={{ textAlign: "center", color: "var(--t3)", fontSize: 11 }}>{idx + 1}</td>
        <td>
          <div style={{ fontWeight: 500, color: "var(--t1)" }}>{b.guest}</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>{b.mobile}</div>
        </td>
        <td style={{ textAlign: "center", fontWeight: 600 }}>{day}</td>
        <td style={{ fontSize: 12, color: "var(--t2)" }}>{b.allocatedRooms.join(", ") || "—"}</td>
        <td style={{ textAlign: "center" }}>{b.adults || "—"}</td>
        <td style={{ textAlign: "center" }}>{b.seniors || "—"}</td>
        <td style={{ textAlign: "center" }}>{b.kidsAbove10 || "—"}</td>
        <td style={{ textAlign: "center" }}>{(b.kids6to10 + b.kids2to6 + b.infantsBelow2) || "—"}</td>
        <td style={{ textAlign: "center" }}>{b.pets || "—"}</td>
        <td style={{ textAlign: "center" }}>
          <span style={{ fontWeight: 600, color: b.mealOn ? "var(--grn)" : "var(--t3)" }}>
            {b.mealOn ? "Yes" : "No"}
          </span>
        </td>
        <td style={{ textAlign: "right", fontWeight: 600, color: b.balance > 0 ? "var(--amb)" : "var(--grn)" }}>
          {b.balance > 0 ? fmt(b.balance) : "Nil"}
        </td>
        <td style={{ textAlign: "center" }}>
          <button className="btn btn-ghost btn-xs" onClick={() => router.push(`/bookings/${b.id}`)}>
            View
          </button>
        </td>
      </tr>
    );

    const foTotalsRow = (totals: ReturnType<typeof paxTotals>, label: string) => (
      <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
        <td colSpan={4} style={{ color: "var(--t1)" }}>{label}</td>
        <td style={{ textAlign: "center" }}>{totals.adults || "—"}</td>
        <td style={{ textAlign: "center" }}>{totals.seniors || "—"}</td>
        <td style={{ textAlign: "center" }}>{totals.kGt14 || "—"}</td>
        <td style={{ textAlign: "center" }}>{totals.kLt14 || "—"}</td>
        <td style={{ textAlign: "center" }}>{totals.pets || "—"}</td>
        <td colSpan={3} />
      </tr>
    );

    return (
      <div className="view">
        <div className="pg-hd">
          <div>
            <h2>Hello, {currentUser}</h2>
            <p>Daily occupancy report &mdash; {foDateLabel}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          {(["today", "tomorrow", "custom"] as const).map((f) => (
            <button
              key={f}
              className={`btn btn-sm${foFilter === f ? " btn-primary" : " btn-ghost"}`}
              onClick={() => setFoFilter(f)}
            >
              {f === "today" ? "Today" : f === "tomorrow" ? "Tomorrow" : "Date"}
            </button>
          ))}
          {foFilter === "custom" && (
            <input
              type="date"
              className="input input-sm"
              value={foCustomDate}
              onChange={(e) => setFoCustomDate(e.target.value)}
              style={{ marginLeft: 4, fontSize: 13, padding: "4px 8px", border: "1px solid var(--bd)", borderRadius: "var(--r1)", background: "var(--surf)", color: "var(--t1)" }}
            />
          )}
        </div>

        {/* Check-ins */}
        <div className="tbl-wrap" style={{ marginBottom: 16 }}>
          <div className="tbl-hd">
            <h3>Check-in&apos;s &mdash; {foCheckIns.length}</h3>
          </div>
          <table>
            <thead>{foTblHead}</thead>
            <tbody>
              {foCheckIns.length === 0 ? (
                <tr><td colSpan={12}><div className="empty-state"><h3>No check-ins</h3><p>No arrivals on this date</p></div></td></tr>
              ) : (
                foCheckIns.map((b, i) => foRow(b, 1, i))
              )}
            </tbody>
          </table>
        </div>

        {/* Stayovers */}
        <div className="tbl-wrap" style={{ marginBottom: 16 }}>
          <div className="tbl-hd">
            <h3>Stayovers &mdash; {foStayovers.length}</h3>
          </div>
          <table>
            <thead>{foTblHead}</thead>
            <tbody>
              {foStayovers.length === 0 ? (
                <tr><td colSpan={12}><div className="empty-state"><h3>No stayovers</h3><p>No in-house guests on this date</p></div></td></tr>
              ) : (
                <>
                  {foStayovers.map((b, i) => foRow(b, nightsBetween(b.checkin, foDate) + 1, i))}
                  {foTotalsRow(soTotals, "Total In-House Guests")}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Check-outs */}
        <div className="tbl-wrap" style={{ marginBottom: 24 }}>
          <div className="tbl-hd">
            <h3>Check-out&apos;s &mdash; {foCheckOuts.length}</h3>
          </div>
          <table>
            <thead>{foTblHead}</thead>
            <tbody>
              {foCheckOuts.length === 0 ? (
                <tr><td colSpan={12}><div className="empty-state"><h3>No check-outs</h3><p>No departures on this date</p></div></td></tr>
              ) : (
                foCheckOuts.map((b, i) => foRow(b, 0, i))
              )}
            </tbody>
          </table>
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
        <a href="/bookings/new" className="btn btn-primary btn-sm">New Booking</a>
      </div>

      {/* ───────── Top summary cards ───────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Revenue card */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
              Revenue
            </span>
            <div style={{ marginLeft: "auto" }}>
              <span className="filter-btn on" style={{ fontSize: 11, padding: "3px 8px" }}>
                Month
              </span>
            </div>
          </div>
          <div className="stat-val" style={{ fontSize: 34 }}>{fmt(revData.total)}</div>
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
                        onClick={() => router.push(`/bookings/${b.id}`)}
                      >
                        View
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 14 }}>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => today && setWeekStart(addDays(weekStart || today, -7))}
            >
              &lsaquo; Prev Week
            </button>
            <input
              type="date"
              value={weekStart || today}
              onChange={(e) => setWeekStart(e.target.value)}
              style={{
                height: 26,
                padding: "0 8px",
                fontSize: 12,
                border: "1px solid var(--bd)",
                borderRadius: "var(--r3)",
                background: "var(--surf)",
                color: "var(--t1)",
                outline: "none",
              }}
            />
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => today && setWeekStart(addDays(weekStart || today, 7))}
            >
              Next Week &rsaquo;
            </button>
            {weekStart && weekStart !== today && (
              <button className="btn btn-ghost btn-xs" onClick={() => setWeekStart("")}>
                Today
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <strong style={{ color: "var(--grn)" }}>Booked</strong>
            {" / "}
            <strong style={{ color: "var(--amb)" }}>Tentative</strong>
            {" / "}
            <strong style={{ color: "var(--t2)" }}>Available</strong>
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
