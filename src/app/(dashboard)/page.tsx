"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { addDays, bookingChargesBreakdown, countsAsRevenue, findAvailableRoomIds, fmt, fmtIN, formatLongDate, nightsBetween, sevenDaysFrom, todayStr, weekRange } from "@/lib/utils";

export default function DashboardPage() {
  const router = useRouter();
  const { bookings, b2bBookings, addOnCategories, bulkRoomBlocks, currentRole, rooms, roomInventory } = useApp();
  const isFrontOffice = currentRole === "Front Office";
  const isFinance = currentRole === "Finance";

  // Finance only has the Revenue Register, so the home page sends them there
  useEffect(() => {
    if (isFinance) router.replace("/revenue");
  }, [isFinance, router]);

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
  const [foTab, setFoTab] = useState<"movement" | "summary" | "meals" | "mealguests" | "b2b">("movement");
  // Room Availability: This Week / Next Week / custom Date Range tabs
  const [weekTab, setWeekTab] = useState<"this" | "next" | "range">("this");
  const [rangeStart, setRangeStart] = useState("");

  useEffect(() => {
    setToday(todayStr());
  }, []);

  // ───── Revenue ─────
  // Mirrors the Revenue Register's Total Charges for the current month:
  // net charges excluding GST for revenue-bearing bookings checking in this
  // month, so the two screens always show the same number.
  const revData = useMemo(() => {
    if (!today) return { total: 0 };
    const month = today.slice(0, 7);
    const total = bookings
      .filter(countsAsRevenue)
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
    // Each kid bucket separately — they carry different meal rates, so the
    // kitchen needs them split rather than lumped into one "Kids" figure.
    const kidsAbove10Of = (b: Bkg) => segFor(b)?.kidsAbove10 ?? b.kidsAbove10;
    const kids6to10Of = (b: Bkg) => segFor(b)?.kids6to10 ?? b.kids6to10;
    const kids2to6Of = (b: Bkg) => segFor(b)?.kids2to6 ?? b.kids2to6;
    const infantsOf = (b: Bkg) => segFor(b)?.infantsBelow2 ?? b.infantsBelow2;
    const petsOf = (b: Bkg) => segFor(b)?.pets ?? b.pets;
    const driversOf = (b: Bkg) => segFor(b)?.drivers ?? b.driverCount ?? 0;
    const mealOnOf = (b: Bkg) => segFor(b)?.mealOn ?? b.mealOn;
    const driverMealOnOf = (b: Bkg) => segFor(b)?.driverMealOn ?? b.driverMealOn ?? false;
    const sum = (arr: Bkg[], fn: (b: Bkg) => number) => arr.reduce((s, b) => s + fn(b), 0);

    const active = bookings.filter(isActive);
    const rollOverBkgs = active.filter(isRollOver);
    const newBkgs = active.filter(isNew);
    // Dayouts have no night, so `isActive` never sees them — they get their
    // own column. Same list the Meal Guest List uses, so the two tabs tie.
    const dayoutBkgs = bookings.filter(
      (b) =>
        b.checkin === d && b.checkout === d &&
        (b.status === "Confirmed" || b.status === "Tentative" || b.status === "Completed")
    );
    const everyone = [...active, ...dayoutBkgs];
    const mealBkgs = everyone.filter(mealOnOf);
    const driverMealBkgs = everyone.filter(driverMealOnOf);

    // Every category is listed whether or not anyone falls into it, so the
    // kitchen reads the same rows every day.
    return [
      {
        label: "Adults",
        rollOver: sum(rollOverBkgs, adultsOf),
        newGuests: sum(newBkgs, adultsOf),
        dayouts: sum(dayoutBkgs, adultsOf),
        meals: sum(mealBkgs, adultsOf),
        total: sum(everyone, adultsOf),
      },
      {
        label: "Sr. Citizens",
        rollOver: sum(rollOverBkgs, seniorsOf),
        newGuests: sum(newBkgs, seniorsOf),
        dayouts: sum(dayoutBkgs, seniorsOf),
        meals: sum(mealBkgs, seniorsOf),
        total: sum(everyone, seniorsOf),
      },
      {
        label: "Kids > 10",
        rollOver: sum(rollOverBkgs, kidsAbove10Of),
        newGuests: sum(newBkgs, kidsAbove10Of),
        dayouts: sum(dayoutBkgs, kidsAbove10Of),
        meals: sum(mealBkgs, kidsAbove10Of),
        total: sum(everyone, kidsAbove10Of),
      },
      {
        label: "Kids 6\u201310",
        rollOver: sum(rollOverBkgs, kids6to10Of),
        newGuests: sum(newBkgs, kids6to10Of),
        dayouts: sum(dayoutBkgs, kids6to10Of),
        meals: sum(mealBkgs, kids6to10Of),
        total: sum(everyone, kids6to10Of),
      },
      {
        label: "Kids 2\u20136",
        rollOver: sum(rollOverBkgs, kids2to6Of),
        newGuests: sum(newBkgs, kids2to6Of),
        dayouts: sum(dayoutBkgs, kids2to6Of),
        meals: sum(mealBkgs, kids2to6Of),
        total: sum(everyone, kids2to6Of),
      },
      {
        label: "Infants (< 2)",
        rollOver: sum(rollOverBkgs, infantsOf),
        newGuests: sum(newBkgs, infantsOf),
        dayouts: sum(dayoutBkgs, infantsOf),
        meals: sum(mealBkgs, infantsOf),
        total: sum(everyone, infantsOf),
      },
      {
        label: "Pets",
        rollOver: sum(rollOverBkgs, petsOf),
        newGuests: sum(newBkgs, petsOf),
        dayouts: sum(dayoutBkgs, petsOf),
        meals: 0,
        total: sum(everyone, petsOf),
      },
      {
        label: "Driver",
        rollOver: sum(rollOverBkgs, driversOf),
        newGuests: sum(newBkgs, driversOf),
        dayouts: sum(dayoutBkgs, driversOf),
        meals: sum(driverMealBkgs, driversOf),
        total: sum(everyone, driversOf),
      },
    ];
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

  // ───── Front Office: Meal Guest List for the selected date ─────
  // Everyone who eats on this date: in-house guests (the same population the
  // PAX Count table counts) plus dayout groups, who have no room but do have
  // meals. Counts come from the segment covering the date.
  const mealGuestList = useMemo(() => {
    const d = foDate;
    if (!d) return [];
    type Bkg = (typeof bookings)[0];
    const segFor = (b: Bkg) => b.segments?.find((s) => s.checkin <= d && d < s.checkout);
    const rowFor = (b: Bkg, day: number, isDayout: boolean) => {
      // A dayout has no night to cover, so its counts sit on the booking
      const seg = isDayout ? undefined : segFor(b);
      return {
        b,
        day,
        isDayout,
        adults: seg?.adults ?? b.adults,
        seniors: seg?.seniors ?? b.seniors,
        kGt10: seg?.kidsAbove10 ?? b.kidsAbove10,
        kLe10: seg
          ? seg.kids6to10 + seg.kids2to6 + seg.infantsBelow2
          : b.kids6to10 + b.kids2to6 + b.infantsBelow2,
        pets: seg?.pets ?? b.pets,
        mealOn: seg?.mealOn ?? b.mealOn,
      };
    };
    const inHouse = bookings
      .filter(
        (b) =>
          (b.status === "Confirmed" || b.status === "Completed") &&
          b.checkin <= d && b.checkout > d
      )
      .map((b) => rowFor(b, nightsBetween(b.checkin, d) + 1, false));
    const dayouts = foDayouts.map((b) => rowFor(b, 1, true));
    // Arrivals first, then longer stays, dayouts last
    inHouse.sort((a, b) => a.day - b.day || a.b.guest.localeCompare(b.b.guest));
    return [...inHouse, ...dayouts];
  }, [bookings, foDate, foDayouts]);

  // ───── Front Office: B2B guests on the selected date ─────
  // A booking shows on every day of its stay, not just its arrival day.
  // Enquiries are not operational yet, so only Tentative and Confirmed appear.
  const b2bGuestsToday = useMemo(() => {
    const d = foDate;
    if (!d) return [];
    return b2bBookings
      .filter((b) => b.status === "Confirmed" || b.status === "Tentative")
      .filter((b) => b.checkin <= d && d <= b.checkout)
      .sort((a, b) => a.checkin.localeCompare(b.checkin) || a.id.localeCompare(b.id));
  }, [b2bBookings, foDate]);

  // Add-on master items become Yes/No columns. "Room Charges" reads better as
  // just "Room" in a column head, so the trailing word is dropped.
  const b2bAddOnCols = useMemo(
    () =>
      addOnCategories.map((c) => ({
        id: c.id,
        name: c.name,
        label: c.name.replace(/\s*charges\s*$/i, "").trim() || c.name,
      })),
    [addOnCategories]
  );

  if (isFinance) {
    return (
      <div className="view">
        <div className="pg-hd"><div><h2>Revenue Register</h2><p>Opening…</p></div></div>
      </div>
    );
  }

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
          <span style={{ fontWeight: 600, color: b.mealOn ? "var(--grn)" : "var(--red)" }}>
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

    // Dayouts table — same markup on Guest Movement and Meal Summary
    const dayoutTable = (
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
    );

    // Both readings of "total yes / total no": how many groups, and how many
    // heads those groups carry (pets excluded — they don't take meals).
    const headsOf = (r: (typeof mealGuestList)[number]) =>
      r.adults + r.seniors + r.kGt10 + r.kLe10;
    const yesRows = mealGuestList.filter((r) => r.mealOn);
    const noRows = mealGuestList.filter((r) => !r.mealOn);
    const mealYes = yesRows.length;
    const mealNo = noRows.length;
    const mealYesPax = yesRows.reduce((s, r) => s + headsOf(r), 0);
    const mealNoPax = noRows.reduce((s, r) => s + headsOf(r), 0);

    const exportMealGuestList = () => {
      const headers = [
        "Sl.", "Guest Name", "Mobile", "C-in", "C-out", "Day", "Room No's",
        "AD", "Sr.Ct", "K>10", "K<=10", "Pets", "Meals",
      ];
      const lines = mealGuestList.map((r, i) => [
        i + 1, r.b.guest, r.b.mobile, fmtIN(r.b.checkin), fmtIN(r.b.checkout), r.day,
        r.isDayout ? "Dayout" : r.b.allocatedRooms.join(" / ") || "—",
        r.adults, r.seniors, r.kGt10, r.kLe10, r.pets, r.mealOn ? "Yes" : "No",
      ]);
      lines.push(["", "Meals — Yes", `${mealYes} bookings`, `${mealYesPax} pax`, "", "", "", "", "", "", "", "", ""]);
      lines.push(["", "Meals — No", `${mealNo} bookings`, `${mealNoPax} pax`, "", "", "", "", "", "", "", "", ""]);
      const csv = [headers, ...lines]
        .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meal_guest_list_${foDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

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
          <button
            className={`btn btn-sm${foTab === "meals" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setFoTab("meals")}
          >
            Meal Summary
          </button>
          <button
            className={`btn btn-sm${foTab === "mealguests" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setFoTab("mealguests")}
          >
            Meal Guest List
          </button>
          <button
            className={`btn btn-sm${foTab === "b2b" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setFoTab("b2b")}
          >
            B2B Guests
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
        {dayoutTable}
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

        </>
        )}

        {foTab === "meals" && (
        <>
        {/* Every guest category, split by where they came from and whether they eat */}
        <div className="tbl-wrap" style={{ marginBottom: 16 }}>
          <div className="tbl-hd">
            <h3>Meal Summary &mdash; {foDayLabel}</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Guest Category</th>
                <th style={{ textAlign: "center" }}>Roll Over Guests</th>
                <th style={{ textAlign: "center" }}>New Guests</th>
                <th style={{ textAlign: "center" }}>Dayouts</th>
                <th style={{ textAlign: "center" }}>Total</th>
                <th style={{ textAlign: "center" }}>Meals</th>
                <th style={{ textAlign: "center" }}>No Meals</th>
              </tr>
            </thead>
            <tbody>
              {guestPaxToday.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <h3>No guests</h3>
                      <p>No confirmed or completed bookings are active on this date</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {guestPaxToday.map((row) => {
                    const isPets = row.label === "Pets";
                    const noMeals = Math.max(0, row.total - row.meals);
                    return (
                      <tr key={row.label}>
                        <td style={{ fontWeight: 500, color: "var(--t1)" }}>{row.label}</td>
                        <td style={{ textAlign: "center" }}>
                          {row.rollOver > 0 ? (
                            <span style={{ fontWeight: 600, color: "var(--t1)" }}>{row.rollOver}</span>
                          ) : (
                            <span style={{ color: "var(--t4)" }}>0</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {row.newGuests > 0 ? (
                            <span style={{ fontWeight: 600, color: "var(--grn)" }}>{row.newGuests}</span>
                          ) : (
                            <span style={{ color: "var(--t4)" }}>0</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {row.dayouts > 0 ? (
                            <span style={{ fontWeight: 600, color: "var(--t1)" }}>{row.dayouts}</span>
                          ) : (
                            <span style={{ color: "var(--t4)" }}>0</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ fontWeight: 700, color: "var(--t1)" }}>{row.total}</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {isPets ? (
                            <span style={{ color: "var(--t4)" }}>—</span>
                          ) : row.meals > 0 ? (
                            <span style={{ fontWeight: 600, color: "var(--amb)" }}>{row.meals}</span>
                          ) : (
                            <span style={{ color: "var(--t4)" }}>0</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {isPets ? (
                            <span style={{ color: "var(--t4)" }}>—</span>
                          ) : noMeals > 0 ? (
                            <span style={{ fontWeight: 600, color: "var(--red)" }}>{noMeals}</span>
                          ) : (
                            <span style={{ color: "var(--t4)" }}>0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                    <td style={{ color: "var(--t1)" }}>Total</td>
                    <td style={{ textAlign: "center", color: "var(--t1)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.rollOver, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--grn)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.newGuests, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--t1)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.dayouts, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--t1)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.total, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--amb)" }}>
                      {guestPaxToday.reduce((s, r) => s + r.meals, 0)}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--red)" }}>
                      {guestPaxToday
                        .filter((r) => r.label !== "Pets")
                        .reduce((s, r) => s + Math.max(0, r.total - r.meals), 0)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        </>
        )}

        {foTab === "mealguests" && (
        <div className="tbl-wrap" style={{ marginBottom: 24 }}>
          <div className="tbl-hd" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <h3>Meal Guest List</h3>
            <button
              className="btn btn-primary btn-sm"
              onClick={exportMealGuestList}
              disabled={mealGuestList.length === 0}
            >
              Download CSV
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: "center" }}>Sl.</th>
                <th>Guest Name</th>
                <th style={{ whiteSpace: "nowrap", width: 92 }}>C-in</th>
                <th style={{ whiteSpace: "nowrap", width: 92 }}>C-out</th>
                <th style={{ textAlign: "center", width: 48 }}>Day</th>
                <th>Room No&apos;s</th>
                <th style={{ textAlign: "center", width: 44 }}>AD</th>
                <th style={{ textAlign: "center", width: 52 }}>Sr.Ct</th>
                <th style={{ textAlign: "center", width: 52 }}>K&gt;10</th>
                <th style={{ textAlign: "center", width: 56 }}>K&le;10</th>
                <th style={{ textAlign: "center", width: 48 }}>Pets</th>
                <th style={{ textAlign: "center", width: 60 }}>Meals</th>
              </tr>
            </thead>
            <tbody>
              {mealGuestList.length === 0 ? (
                <tr>
                  <td colSpan={12}>
                    <div className="empty-state">
                      <h3>No guests</h3>
                      <p>Nobody is in-house or on a dayout for this date</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {mealGuestList.map((r, i) => (
                    <tr key={r.b.id}>
                      <td style={{ textAlign: "center", color: "var(--t3)", fontSize: 11 }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500, color: "var(--t1)" }}>{r.b.guest}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)" }}>{r.b.mobile}</div>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtIN(r.b.checkin)}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtIN(r.b.checkout)}</td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{r.day}</td>
                      <td style={{ fontSize: 12, color: "var(--t2)" }}>
                        {r.isDayout ? "Dayout" : r.b.allocatedRooms.join(", ") || "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>{r.adults || "—"}</td>
                      <td style={{ textAlign: "center" }}>{r.seniors || "—"}</td>
                      <td style={{ textAlign: "center" }}>{r.kGt10 || "—"}</td>
                      <td style={{ textAlign: "center" }}>{r.kLe10 || "—"}</td>
                      <td style={{ textAlign: "center" }}>{r.pets || "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 600, color: r.mealOn ? "var(--grn)" : "var(--red)" }}>
                          {r.mealOn ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
        )}

        {foTab === "b2b" && (
        <div className="tbl-wrap" style={{ marginBottom: 24 }}>
          <div className="tbl-hd">
            <h3>B2B Guests</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>Booking ID</th>
                <th>Organisation</th>
                <th style={{ whiteSpace: "nowrap", width: 100 }}>C-in</th>
                <th style={{ whiteSpace: "nowrap", width: 100 }}>C-out</th>
                <th style={{ textAlign: "center", width: 60 }}>Pax</th>
                {b2bAddOnCols.map((c) => (
                  <th key={c.id} style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b2bGuestsToday.length === 0 ? (
                <tr>
                  <td colSpan={5 + b2bAddOnCols.length}>
                    <div className="empty-state">
                      <h3>No B2B guests</h3>
                      <p>No corporate, school or institute booking on this date</p>
                    </div>
                  </td>
                </tr>
              ) : (
                b2bGuestsToday.map((b) => {
                  const names = new Set((b.extras ?? []).map((e) => e.name));
                  return (
                    <tr key={b.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--acc)", fontWeight: 700 }}>
                          {b.id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: "var(--t1)" }}>{b.orgName}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)" }}>
                          {b.type}
                          {b.bookingType === "Dayout" ? " · Dayout" : ""}
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtIN(b.checkin)}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtIN(b.checkout)}</td>
                      <td style={{ textAlign: "center", fontWeight: 600 }}>{b.pax || "—"}</td>
                      {b2bAddOnCols.map((c) => {
                        const has = names.has(c.name);
                        return (
                          <td key={c.id} style={{ textAlign: "center" }}>
                            <span style={{ fontWeight: 600, color: has ? "var(--grn)" : "var(--red)" }}>
                              {has ? "Yes" : "No"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
