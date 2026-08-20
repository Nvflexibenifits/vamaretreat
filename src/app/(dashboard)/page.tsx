"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { addDays, bookingChargesBreakdown, findAvailableRoomIds, fmt, fmtIN, formatLongDate, nightsBetween, sevenDaysFrom, todayStr, weekRange } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { bookings, bulkRoomBlocks, currentRole, rooms, roomInventory } = useApp();
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
  const [pendingOpen, setPendingOpen] = useState(false);
  const [foFilter, setFoFilter] = useState<"today" | "tomorrow" | "custom">("today");
  const [foCustomDate, setFoCustomDate] = useState("");
  // Front Office dashboard tabs: guest movement tables vs daily summaries
  const [foTab, setFoTab] = useState<"movement" | "summary">("movement");
  // Room Availability: This Week / Next Week / custom Date Range tabs
  const [weekTab, setWeekTab] = useState<"this" | "next" | "range">("this");
  const [rangeStart, setRangeStart] = useState("");

  useEffect(() => {
    setToday(todayStr());
  }, []);

  // ───── Revenue ─────
  // Mirrors the Revenue Register's Total Charges for the current month:
  // net charges excluding GST for Confirmed + Cancelled bookings checking in
  // this month, so the two screens always show the same number.
  const revData = useMemo(() => {
    if (!today) return { total: 0 };
    const month = today.slice(0, 7);
    const total = bookings
      .filter((b) => b.status === "Confirmed" || b.status === "Cancelled")
      .filter((b) => b.checkin.startsWith(month))
      .reduce((s, b) => {
        const c = bookingChargesBreakdown(b);
        return s + c.roomNet + c.mealNet + c.other;
      }, 0);
    return { total };
  }, [bookings, today]);

  // ───── Payment Pending ─────
  const pendingBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.balance >= 1 && b.status !== "Cancelled" && b.status !== "Lost")
        .sort((a, b) => a.checkin.localeCompare(b.checkin)),
    [bookings]
  );

  const totalPending = useMemo(
    () => pendingBookings.reduce((s, b) => s + b.balance, 0),
    [pendingBookings]
  );

  // ───── Room Availability (7 days from the selected tab's anchor) ─────
  const roomDates = useMemo(() => {
    if (!today) return [];
    const anchor =
      weekTab === "next" ? addDays(today, 7)
      : weekTab === "range" ? rangeStart || today
      : today;
    return sevenDaysFrom(anchor);
  }, [today, weekTab, rangeStart]);

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

  // ───── Front Office: daily report filter date (shared by all FO tabs) ─────
  const foDate = useMemo(() => {
    if (!today) return "";
    if (foFilter === "today") return today;
    if (foFilter === "tomorrow") return addDays(today, 1);
    return foCustomDate || today;
  }, [today, foFilter, foCustomDate]);

  // ───── Front Office: Room Summary for the selected date ─────
  const roomSummaryToday = useMemo(() => {
    const d = foDate;
    if (!d) return [];
    const getRoomCount = (b: (typeof bookings)[0], catId: string): number => {
      let qty = 0;
      b.segments
        .filter((seg) => seg.checkin <= d && d < seg.checkout)
        .forEach((seg) => {
          seg.rooms
            .filter((r) => r.roomId === catId)
            .forEach((r) => { qty = Math.max(qty, r.numRooms); });
        });
      return qty;
    };
    // Every category is listed (booked or not); available counts physical
    // rooms free that night — bookings, blocks, and maintenance all consume.
    return rooms.map((r) => {
      let rollOver = 0;
      let newCheckin = 0;
      bookings.forEach((b) => {
        if (b.status !== "Confirmed" && b.status !== "Completed") return;
        const qty = getRoomCount(b, r.id);
        if (qty === 0) return;
        if (b.checkin < d && b.checkout > d) rollOver += qty;
        else if (b.checkin === d && b.checkout > d) newCheckin += qty;
      });
      const available = findAvailableRoomIds(
        r.id, d, addDays(d, 1), bookings, roomInventory, undefined, bulkRoomBlocks
      ).length;
      return { category: r.name, rollOver, newCheckin, total: rollOver + newCheckin, available };
    });
  }, [rooms, bookings, roomInventory, bulkRoomBlocks, foDate]);

  // ───── Front Office: PAX Count for the selected date ─────
  // Counts come from the segment covering the date (bookings with multiple
  // date ranges carry different pax/meals per segment); booking-level fallback.
  const guestPaxToday = useMemo(() => {
    const d = foDate;
    if (!d) return [];
    type Bkg = (typeof bookings)[0];
    const isActive = (b: Bkg) =>
      (b.status === "Confirmed" || b.status === "Completed") &&
      b.checkin <= d && b.checkout > d;
    const isRollOver = (b: Bkg) => b.checkin < d;
    const isNew = (b: Bkg) => b.checkin === d;
    const segFor = (b: Bkg) => b.segments?.find((s) => s.checkin <= d && d < s.checkout);
    const adultsOf = (b: Bkg) => segFor(b)?.adults ?? b.adults;
    const seniorsOf = (b: Bkg) => segFor(b)?.seniors ?? b.seniors;
    const kidsOf = (b: Bkg) => {
      const s = segFor(b);
      return s
        ? s.kidsAbove10 + s.kids6to10 + s.kids2to6 + s.infantsBelow2
        : b.kidsAbove10 + b.kids6to10 + b.kids2to6 + b.infantsBelow2;
    };
    const petsOf = (b: Bkg) => segFor(b)?.pets ?? b.pets;
    const driversOf = (b: Bkg) => segFor(b)?.drivers ?? b.driverCount ?? 0;
    const mealOnOf = (b: Bkg) => segFor(b)?.mealOn ?? b.mealOn;
    const driverMealOnOf = (b: Bkg) => segFor(b)?.driverMealOn ?? b.driverMealOn ?? false;
    const sum = (arr: Bkg[], fn: (b: Bkg) => number) => arr.reduce((s, b) => s + fn(b), 0);

    const active = bookings.filter(isActive);
    const rollOverBkgs = active.filter(isRollOver);
    const newBkgs = active.filter(isNew);
    const mealBkgs = active.filter(mealOnOf);
    const driverMealBkgs = active.filter(driverMealOnOf);

    return [
      {
        label: "Adults",
        rollOver: sum(rollOverBkgs, adultsOf),
        newGuests: sum(newBkgs, adultsOf),
        meals: sum(mealBkgs, adultsOf),
        total: sum(active, adultsOf),
      },
      {
        label: "Sr. Citizens",
        rollOver: sum(rollOverBkgs, seniorsOf),
        newGuests: sum(newBkgs, seniorsOf),
        meals: sum(mealBkgs, seniorsOf),
        total: sum(active, seniorsOf),
      },
      {
        label: "Kids",
        rollOver: sum(rollOverBkgs, kidsOf),
        newGuests: sum(newBkgs, kidsOf),
        meals: sum(mealBkgs, kidsOf),
        total: sum(active, kidsOf),
      },
      {
        label: "Pets",
        rollOver: sum(rollOverBkgs, petsOf),
        newGuests: sum(newBkgs, petsOf),
        meals: 0,
        total: sum(active, petsOf),
      },
      {
        label: "Driver",
        rollOver: sum(rollOverBkgs, driversOf),
        newGuests: sum(newBkgs, driversOf),
        meals: sum(driverMealBkgs, driversOf),
        total: sum(active, driversOf),
      },
    ].filter((row) => row.total > 0);
  }, [bookings, foDate]);

  // ───── Front Office: Check-ins / Stayovers / Check-outs / Dayouts ─────
  const foCheckIns = useMemo(() => {
    if (!foDate) return [];
    return bookings.filter(
      (b) => b.checkin === foDate && b.checkout > b.checkin &&
        (b.status === "Confirmed" || b.status === "Tentative")
    );
  }, [bookings, foDate]);

  // Same-day bookings (no room) get their own table
  const foDayouts = useMemo(() => {
    if (!foDate) return [];
    return bookings.filter(
      (b) => b.checkin === foDate && b.checkout === foDate &&
        (b.status === "Confirmed" || b.status === "Tentative" || b.status === "Completed")
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
      (b) => b.checkout === foDate && b.checkout > b.checkin &&
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
        <th style={{ whiteSpace: "nowrap", width: 92 }}>C-in</th>
        <th style={{ whiteSpace: "nowrap", width: 92 }}>C-out</th>
        <th style={{ textAlign: "center", width: 48 }}>Day</th>
        <th>Room No's</th>
        <th style={{ textAlign: "center", width: 44 }}>AD</th>
        <th style={{ textAlign: "center", width: 52 }}>Sr.Ct</th>
        <th style={{ textAlign: "center", width: 52 }}>K&gt;10</th>
        <th style={{ textAlign: "center", width: 56 }}>K&le;10</th>
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
        <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtIN(b.checkin)}</td>
        <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtIN(b.checkout)}</td>
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
        <td style={{ textAlign: "right", fontWeight: 600, color: b.balance >= 1 ? "var(--amb)" : "var(--grn)" }}>
          {b.balance >= 1 ? fmt(b.balance) : "Nil"}
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
        <td colSpan={6} style={{ color: "var(--t1)" }}>{label}</td>
        <td style={{ textAlign: "center" }}>{totals.adults || "—"}</td>
        <td style={{ textAlign: "center" }}>{totals.seniors || "—"}</td>
        <td style={{ textAlign: "center" }}>{totals.kGt14 || "—"}</td>
        <td style={{ textAlign: "center" }}>{totals.kLt14 || "—"}</td>
        <td style={{ textAlign: "center" }}>{totals.pets || "—"}</td>
        <td colSpan={3} />
      </tr>
    );

    const foDayLabel =
      foFilter === "today" ? "Today" : foFilter === "tomorrow" ? "Tomorrow" : fmtIN(foDate);

    return (
      <div className="view">
        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--bd)", paddingBottom: 12 }}>
          <button
            className={`btn btn-sm${foTab === "movement" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setFoTab("movement")}
          >
            Guest Movement
          </button>
          <button
            className={`btn btn-sm${foTab === "summary" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setFoTab("summary")}
          >
            Room &amp; Pax Summary
          </button>
        </div>

        {/* Date filter — applies to both tabs */}
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

        {/* Selected report date — shared by both tabs */}
        {foDate && (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)", margin: "-8px 0 16px" }}>
            {formatLongDate(new Date(foDate + "T00:00:00"))}
          </div>
        )}

        {foTab === "movement" && (
        <>
        {/* Check-ins */}
        <div className="tbl-wrap" style={{ marginBottom: 16 }}>
          <div className="tbl-hd">
            <h3>Check-in&apos;s &mdash; {foCheckIns.length}</h3>
          </div>
          <table>
            <thead>{foTblHead}</thead>
            <tbody>
              {foCheckIns.length === 0 ? (
                <tr><td colSpan={14}><div className="empty-state"><h3>No check-ins</h3><p>No arrivals on this date</p></div></td></tr>
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
                <tr><td colSpan={14}><div className="empty-state"><h3>No stayovers</h3><p>No in-house guests on this date</p></div></td></tr>
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
        <div className="tbl-wrap" style={{ marginBottom: 16 }}>
          <div className="tbl-hd">
            <h3>Check-out&apos;s &mdash; {foCheckOuts.length}</h3>
          </div>
          <table>
            <thead>{foTblHead}</thead>
            <tbody>
              {foCheckOuts.length === 0 ? (
                <tr><td colSpan={14}><div className="empty-state"><h3>No check-outs</h3><p>No departures on this date</p></div></td></tr>
              ) : (
                foCheckOuts.map((b, i) => foRow(b, 0, i))
              )}
            </tbody>
          </table>
        </div>

        {/* Dayouts — same-day bookings, meals without a room */}
        <div className="tbl-wrap" style={{ marginBottom: 24 }}>
          <div className="tbl-hd">
            <h3>Dayout&apos;s &mdash; {foDayouts.length}</h3>
          </div>
          <table>
            <thead>{foTblHead}</thead>
            <tbody>
              {foDayouts.length === 0 ? (
                <tr><td colSpan={14}><div className="empty-state"><h3>No dayouts</h3><p>No same-day guests on this date</p></div></td></tr>
              ) : (
                <>
                  {foDayouts.map((b, i) => foRow(b, 1, i))}
                  {foTotalsRow(paxTotals(foDayouts), "Total Dayout Pax")}
                </>
              )}
            </tbody>
          </table>
        </div>
        </>
        )}

        {foTab === "summary" && (
        <>
        {/* Room Summary */}
        <div className="tbl-wrap" style={{ marginBottom: 16 }}>
          <div className="tbl-hd">
            <h3>Room Summary &mdash; {foDayLabel}</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Room Category</th>
                <th style={{ textAlign: "center" }}>Roll Over Rooms</th>
                <th style={{ textAlign: "center" }}>New Check-ins</th>
                <th style={{ textAlign: "center" }}>Total Occupancy</th>
                <th style={{ textAlign: "center" }}>Available Rooms</th>
              </tr>
            </thead>
            <tbody>
              {roomSummaryToday.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <h3>No room categories</h3>
                      <p>Set up room categories in Master Setup first</p>
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
                        {row.total > 0 ? (
                          <span style={{ fontWeight: 700, color: "var(--t1)" }}>{row.total}</span>
                        ) : (
                          <span style={{ color: "var(--t4)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 700, color: row.available > 0 ? "var(--grn)" : "var(--red)" }}>
                          {row.available}
                        </span>
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
                    <td style={{ textAlign: "center", color: "var(--grn)" }}>
                      {roomSummaryToday.reduce((s, r) => s + r.available, 0)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* PAX Count */}
        <div className="tbl-wrap">
          <div className="tbl-hd">
            <h3>PAX Count &mdash; {foDayLabel}</h3>
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
                      <h3>No guests</h3>
                      <p>No confirmed or completed bookings are active on this date</p>
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
        </>
        )}
      </div>
    );
  }

  return (
    <div className="view">
      <div className="pg-hd">
        <div></div>
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

      {/* ───────── Room Availability ───────── */}
      <div className="tbl-wrap" style={{ marginBottom: 16 }}>
        <div className="tbl-hd">
          <h3>Room Availability</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 14 }}>
            {([["this", "This Week"], ["next", "Next Week"], ["range", "Date Range"]] as const).map(([key, label]) => (
              <button
                key={key}
                className={`btn btn-xs${weekTab === key ? " btn-primary" : " btn-ghost"}`}
                onClick={() => setWeekTab(key)}
              >
                {label}
              </button>
            ))}
            {weekTab === "range" && (
              <input
                type="date"
                value={rangeStart || today}
                onChange={(e) => setRangeStart(e.target.value)}
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
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <strong style={{ color: "var(--grn)" }}>B: Booked</strong>
            <strong style={{ color: "var(--amb)" }}>T: Tentative</strong>
            <strong style={{ color: "var(--t2)" }}>A: Available</strong>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th rowSpan={2} style={{ verticalAlign: "bottom" }}>Room Category</th>
                {roomDates.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const wk = dt.toLocaleDateString("en-IN", { weekday: "short" });
                  const dm = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
                  return (
                    <th key={d} colSpan={3} style={{ textAlign: "center", borderLeft: "1px solid var(--bd)" }}>
                      <div>{wk}</div>
                      <div style={{ fontSize: 9, color: "var(--t4)", fontWeight: 500, marginTop: 2 }}>{dm}</div>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {roomDates.flatMap((d) => [
                  <th key={`${d}-b`} style={{ textAlign: "center", fontSize: 10, color: "var(--grn)", borderLeft: "1px solid var(--bd)", width: 36 }}>B</th>,
                  <th key={`${d}-t`} style={{ textAlign: "center", fontSize: 10, color: "var(--amb)", width: 36 }}>T</th>,
                  <th key={`${d}-a`} style={{ textAlign: "center", fontSize: 10, color: "var(--t2)", width: 36 }}>A</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {roomStatus.map((row) => (
                <tr key={row.name} style={{ cursor: "default" }}>
                  <td>
                    <div style={{ fontWeight: 500, color: "var(--t1)" }}>{row.name}</div>
                  </td>
                  {row.cells.flatMap((c) => [
                    <td key={`${c.date}-b`} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: c.booked > 0 ? "var(--grn)" : "var(--t4)", borderLeft: "1px solid var(--bd)" }}>{c.booked}</td>,
                    <td key={`${c.date}-t`} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: c.tentative > 0 ? "var(--amb)" : "var(--t4)" }}>{c.tentative}</td>,
                    <td key={`${c.date}-a`} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "var(--t2)" }}>{c.available}</td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
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

    </div>
  );
}
