"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { bookingMealCharges, dayName, fmt, fmtIN, getBookingPricingRows, nightsBetween } from "@/lib/utils";

// dd/mm/yy — compact date format matching the booking view page
function fmtShort(d: string): string {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y.slice(2)}`;
}
import type { PricingRow } from "@/types";

const TH: React.CSSProperties = {
  background: "#0f2318",
  color: "#fff",
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 700,
  border: "1px solid #0f2318",
  textTransform: "uppercase",
  letterSpacing: ".3px",
};
const TD: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: 11.5,
  border: "1px solid #d0c9bc",
  color: "#1a1a16",
};
const TD_NUM: React.CSSProperties = { ...TD, textAlign: "right" };
const TD_HEAD: React.CSSProperties = { ...TD, background: "#f4f1ea", fontWeight: 700 };
const TD_HEAD_NUM: React.CSSProperties = { ...TD_HEAD, textAlign: "right" };
const TD_GRAND: React.CSSProperties = {
  ...TD,
  background: "#fde8c8",
  fontWeight: 800,
  color: "#0f2318",
};
const TD_GRAND_NUM: React.CSSProperties = { ...TD_GRAND, textAlign: "right" };
const TD_YELLOW: React.CSSProperties = {
  ...TD,
  background: "#fff3a3",
  fontWeight: 700,
  textAlign: "right",
};
export default function ConfirmationPage() {
  const params = useParams<{ id: string }>();
  const { bookings, hydrated } = useApp();
  const id = params?.id;
  const b = bookings.find((x) => x.id === id);

  // The browser names the downloaded PDF after the page title
  useEffect(() => {
    if (b) document.title = `Vama Retreats - ${b.guest}`;
  }, [b]);

  if (!hydrated) {
    return (
      <div style={{ padding: 40, fontFamily: "DM Sans, sans-serif", color: "#52524a" }}>
        Loading…
      </div>
    );
  }

  if (!b) {
    return (
      <div style={{ padding: 40, fontFamily: "DM Sans, sans-serif" }}>
        <h1 style={{ fontFamily: "Outfit, sans-serif" }}>Booking not found</h1>
        <p>No booking with id {id}.</p>
      </div>
    );
  }

  const pricingRows = getBookingPricingRows(b);
  const totalRoomBaseCharges = pricingRows.reduce((s, r) => s + r.roomCharges, 0);
  const totalNet = pricingRows.reduce((s, r) => s + r.netCharges, 0);
  const totalRoomGst = pricingRows.reduce((s, r) => s + r.gstAmt, 0);
  const totalRoomAmt = pricingRows.reduce((s, r) => s + r.totalAmt, 0);
  const totalRooms = (() => {
    const m = new Map<string, number>();
    b.segments.forEach((seg) => {
      seg.rooms.forEach((r) => { m.set(r.roomId, Math.max(m.get(r.roomId) ?? 0, r.numRooms)); });
    });
    return Array.from(m.values()).reduce((s, n) => s + n, 0);
  })();
  const mealCharges = b.mealOn ? b.mealTotal : 0;
  const mealGst = b.mealOn ? b.mealGst : 0;
  const totalMealAmt = mealCharges + mealGst;
  const petCharges = b.petTotal || 0;
  const petGstAmt = b.petGst || 0;
  const totalPetAmt = petCharges + petGstAmt;
  const driverMealCharges = b.driverMealTotal ?? 0;
  const driverMealGstAmt = b.driverMealGst ?? 0;
  const totalDriverMealAmt = driverMealCharges + driverMealGstAmt;
  // mealTotal / mealGst already include the pet package — petCharges is a
  // breakdown of a line inside them, shown as its own row. Adding it again
  // would inflate the guest's total against what the booking actually bills.
  const meal = bookingMealCharges(b);
  const totalMealPetCharges = meal.net;
  const totalMealPetGst = meal.gst;
  const totalMealPet = meal.net + meal.gst;
  // Legacy bookings with no itemised meal rows fall back to a single meal row
  // plus a pet row, so that row must exclude the pet to avoid showing it twice.
  const mealOnlyCharges = Math.max(0, mealCharges - petCharges);
  const mealOnlyGst = Math.max(0, mealGst - petGstAmt);

  const extras = b.extras ?? [];
  const extrasBasic = extras.reduce((s, e) => s + e.amount, 0);
  const extrasGst = extras.reduce((s, e) => s + (e.gst ?? 0), 0);
  const extrasTotal = extrasBasic + extrasGst;

  const grandTotal = totalRoomAmt + totalMealPet + extrasTotal;
  const grandRaw = totalRoomBaseCharges + totalMealPetCharges + extrasBasic;

  // Same-day booking: no night is sold, so there are no accommodation charges
  const isDayout = !!b.checkin && b.checkin === b.checkout;
  const showMealTable = b.mealOn || (b.pets || 0) > 0 || (b.driverMealOn ?? false);

  // Per-segment meal rows (new bookings store rates per segment); legacy
  // bookings without stored rates fall back to booking-level derived rows.
  const segMealRows = (b.segments ?? []).flatMap((seg) => {
    const segNights = seg.checkin === seg.checkout ? 1 : nightsBetween(seg.checkin, seg.checkout);
    const dates = `${fmtIN(seg.checkin)} → ${fmtIN(seg.checkout)}`;
    const rows: { key: string; label: string; dates: string; rate: number; nights: number; pax: number; chg: number }[] = [];
    if (segNights <= 0) return rows;
    if (Array.isArray(seg.mealItems) && seg.mealItems.length > 0) {
      seg.mealItems.forEach((mi) =>
        rows.push({ key: `${seg.id}-${mi.id}`, label: mi.packageName, dates, rate: mi.rate, nights: segNights, pax: mi.pax, chg: mi.total })
      );
      if ((seg.pets ?? 0) > 0)
        rows.push({ key: `${seg.id}-pet`, label: "Pet Package", dates, rate: seg.petRate ?? 0, nights: segNights, pax: seg.pets, chg: (seg.petRate ?? 0) * segNights * seg.pets });
      return rows;
    }
    if (seg.mealOn && (seg.mealRate ?? 0) > 0 && seg.adults > 0)
      rows.push({ key: `${seg.id}-meal`, label: "Meal & Activity Package", dates, rate: seg.mealRate ?? 0, nights: segNights, pax: seg.adults, chg: (seg.mealRate ?? 0) * segNights * seg.adults });
    if ((seg.pets ?? 0) > 0)
      rows.push({ key: `${seg.id}-pet`, label: "Pet Package", dates, rate: seg.petRate ?? 0, nights: segNights, pax: seg.pets, chg: (seg.petRate ?? 0) * segNights * seg.pets });
    if (seg.driverMealOn && (seg.drivers ?? 0) > 0 && (seg.driverMealRate ?? 0) > 0)
      rows.push({ key: `${seg.id}-drv`, label: "Driver / Attendant Meal", dates, rate: seg.driverMealRate ?? 0, nights: segNights, pax: seg.drivers ?? 0, chg: (seg.driverMealRate ?? 0) * segNights * (seg.drivers ?? 0) });
    return rows;
  });

  return (
    <div className="confirmation-root" style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Print controls */}
      <div
        className="no-print"
        style={{
          position: "sticky",
          top: 0,
          padding: "12px 24px",
          background: "#fff",
          borderBottom: "1px solid #d0c9bc",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: "8px 18px",
            background: "#0f2318",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          Print / Download PDF
        </button>
        <button
          type="button"
          onClick={() => window.close()}
          style={{
            padding: "8px 18px",
            background: "#fff",
            color: "#52524a",
            border: "1px solid #d0c9bc",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
          }}
        >
          Close
        </button>
      </div>

      <div
        className="confirmation-sheet"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 32px",
          fontFamily: "DM Sans, sans-serif",
          color: "#1a1a16",
        }}
      >
        {/* Letterhead */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center", marginBottom: 16 }}>
          {/* Logo + address */}
          <div>
            <div
              style={{
                fontFamily: "Outfit, sans-serif",
                fontWeight: 800,
                fontSize: 26,
                color: "#0f2318",
                letterSpacing: ".5px",
                lineHeight: 1,
              }}
            >
              VAMA
            </div>
            <div
              style={{
                fontFamily: "Outfit, sans-serif",
                fontWeight: 600,
                fontSize: 13,
                color: "#0f2318",
                letterSpacing: 4,
                marginTop: 2,
                marginBottom: 6,
              }}
            >
              RETREATS
            </div>
            <div style={{ fontSize: 10, color: "#52524a", lineHeight: 1.4 }}>
              Survey Number 27-1, Canterbury Castles Layout,<br />
              Oodanahalli, near Nandi Hills
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "Outfit, sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: "#0f2318",
              }}
            >
              {b.status === "Confirmed" || b.status === "Completed"
                ? "BOOKING CONFIRMATION"
                : "BOOKING PRICING"}
            </div>
            <div style={{ fontSize: 11, color: "#52524a", marginTop: 3 }}>
              {b.id}
              {(() => {
                // Date the booking was made; legacy bookings fall back to
                // their earliest recorded payment date.
                const made = b.createdAt || [...(b.payments ?? [])].map((p) => p.date).sort()[0];
                return made ? ` · ${fmtIN(made)}` : "";
              })()}
            </div>
          </div>

          {/* REX */}
          <div style={{ textAlign: "right", fontSize: 12, color: "#52524a" }}>
            REX: {b.rex}
          </div>
        </div>

        {/* Guest info block — stay dates, nights, and pax live in Accommodation Charges below */}
        <div
          style={{
            border: "1px solid #d0c9bc",
            marginBottom: 14,
          }}
        >
          <GuestRow label="Guest Name" value={b.guest} />
          <GuestRow label="Mobile No." value={b.mobile} />
          <GuestRow label="Source" value={b.source || "—"} last />
        </div>

        {/* PAX Count — one row per date range */}
        <div
          style={{
            background: "#0f2318",
            color: "#fff",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            fontFamily: "Outfit, sans-serif",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: ".5px",
            textTransform: "uppercase",
          }}
        >
          <span>PAX Count</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={TH}>C-in</th>
              <th style={TH}>C-out</th>
              <th style={{ ...TH, textAlign: "center" }}>AD</th>
              <th style={{ ...TH, textAlign: "center" }}>Sr. Ct</th>
              <th style={{ ...TH, textAlign: "center" }}>K &gt; 10</th>
              <th style={{ ...TH, textAlign: "center" }}>K 6-10</th>
              <th style={{ ...TH, textAlign: "center" }}>K 2-6</th>
              <th style={{ ...TH, textAlign: "center" }}>Inf &lt; 2</th>
              <th style={{ ...TH, textAlign: "center" }}>Pets</th>
            </tr>
          </thead>
          <tbody>
            {(b.segments?.length ? b.segments : [null]).map((seg, i) => {
              const counts = seg
                ? {
                    checkin: seg.checkin, checkout: seg.checkout,
                    adults: seg.adults, seniors: seg.seniors, kidsAbove10: seg.kidsAbove10,
                    kids6to10: seg.kids6to10, kids2to6: seg.kids2to6, infants: seg.infantsBelow2, pets: seg.pets,
                  }
                : {
                    checkin: b.checkin, checkout: b.checkout,
                    adults: b.adults, seniors: b.seniors, kidsAbove10: b.kidsAbove10,
                    kids6to10: b.kids6to10, kids2to6: b.kids2to6, infants: b.infantsBelow2, pets: b.pets,
                  };
              return (
                <tr key={seg?.id ?? i}>
                  <td style={{ ...TD, whiteSpace: "nowrap" }}>
                    <div>{fmtShort(counts.checkin)}</div>
                    <div style={{ fontSize: 10, color: "#52524a" }}>{dayName(counts.checkin)}</div>
                  </td>
                  <td style={{ ...TD, whiteSpace: "nowrap" }}>
                    <div>{fmtShort(counts.checkout)}</div>
                    <div style={{ fontSize: 10, color: "#52524a" }}>{dayName(counts.checkout)}</div>
                  </td>
                  <td style={{ ...TD, textAlign: "center", fontWeight: counts.adults > 0 ? 700 : 400 }}>{counts.adults}</td>
                  <td style={{ ...TD, textAlign: "center", fontWeight: counts.seniors > 0 ? 700 : 400 }}>{counts.seniors}</td>
                  <td style={{ ...TD, textAlign: "center", fontWeight: counts.kidsAbove10 > 0 ? 700 : 400 }}>{counts.kidsAbove10}</td>
                  <td style={{ ...TD, textAlign: "center", fontWeight: counts.kids6to10 > 0 ? 700 : 400 }}>{counts.kids6to10}</td>
                  <td style={{ ...TD, textAlign: "center", fontWeight: counts.kids2to6 > 0 ? 700 : 400 }}>{counts.kids2to6}</td>
                  <td style={{ ...TD, textAlign: "center", fontWeight: counts.infants > 0 ? 700 : 400 }}>{counts.infants}</td>
                  <td style={{ ...TD, textAlign: "center", fontWeight: counts.pets > 0 ? 700 : 400 }}>{counts.pets}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Accommodation Charges — a dayout books no room, so the whole
            block is dropped rather than printing an empty table */}
        {!isDayout && (
          <>
          {/* Accommodation Charges */}
          <div
            style={{
              background: "#0f2318",
              color: "#fff",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              fontFamily: "Outfit, sans-serif",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: ".5px",
              textTransform: "uppercase",
            }}
          >
            <span>Accomodation Charges</span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
            <thead>
              <tr>
                <th style={TH}>Category</th>
                <th style={{ ...TH, textAlign: "right" }}>C-in</th>
                <th style={{ ...TH, textAlign: "right" }}>C-out</th>
                <th style={{ ...TH, textAlign: "right" }}>Nights</th>
                <th style={{ ...TH, textAlign: "right" }}>Rate</th>
                <th style={{ ...TH, textAlign: "right" }}>Disc %</th>
                <th style={{ ...TH, textAlign: "right" }}>Net Rate</th>
                <th style={{ ...TH, textAlign: "right" }}>Rooms</th>
                <th style={{ ...TH, textAlign: "right" }}>Charges</th>
                <th style={{ ...TH, textAlign: "right" }}>GST %</th>
                <th style={{ ...TH, textAlign: "right" }}>GST Amt</th>
                <th style={{ ...TH, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pricingRows.length === 0 ? (
                <tr>
                  <td style={{ ...TD, textAlign: "center" }} colSpan={12}>
                    No pricing rows
                  </td>
                </tr>
              ) : (
                pricingRows.map((r: PricingRow, i: number) => {
                  const netRatePerNight = r.nights > 0 && r.numRooms > 0
                    ? Math.round(r.netCharges / r.nights / r.numRooms)
                    : r.tariff;
                  return (
                    <tr key={i}>
                      <td style={TD}>{r.roomName}</td>
                      <td style={{ ...TD_NUM, whiteSpace: "nowrap" }}>
                        <div>{fmtShort(r.checkin || b.checkin)}</div>
                        <div style={{ fontSize: 10, color: "#52524a" }}>{dayName(r.checkin || b.checkin)}</div>
                      </td>
                      <td style={{ ...TD_NUM, whiteSpace: "nowrap" }}>
                        <div>{fmtShort(r.checkout || b.checkout)}</div>
                        <div style={{ fontSize: 10, color: "#52524a" }}>{dayName(r.checkout || b.checkout)}</div>
                      </td>
                      <td style={TD_NUM}>{r.nights}</td>
                      <td style={TD_NUM}>{fmt(r.tariff)}</td>
                      <td style={TD_NUM}>{r.discountPct > 0 ? `${r.discountPct}%` : "—"}</td>
                      <td style={TD_NUM}>{fmt(netRatePerNight)}</td>
                      <td style={TD_NUM}>{r.numRooms}</td>
                      <td style={TD_NUM}>{fmt(r.netCharges)}</td>
                      <td style={TD_NUM}>{r.gstRate}%</td>
                      <td style={TD_NUM}>{fmt(r.gstAmt)}</td>
                      <td style={TD_NUM}>{fmt(r.totalAmt)}</td>
                    </tr>
                  );
                })
              )}
              <tr>
                <td style={TD_HEAD}>Total Room Charges</td>
                <td style={TD_HEAD} colSpan={7}></td>
                <td style={TD_HEAD_NUM}>{fmt(totalNet)}</td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD_NUM}>{fmt(totalRoomGst)}</td>
                <td style={TD_HEAD_NUM}>{fmt(totalRoomAmt)}</td>
              </tr>
            </tbody>
          </table>
          </>
        )}

        {/* Meal/Pet Charges */}
        {showMealTable && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
            <thead>
              <tr>
                <th style={TH}>Meal Charges</th>
                <th style={{ ...TH, textAlign: "right" }}>Rate</th>
                <th style={{ ...TH, textAlign: "right" }}>Nights</th>
                <th style={{ ...TH, textAlign: "right" }}>Pax</th>
                <th style={{ ...TH, textAlign: "right" }}>Charges</th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={{ ...TH, textAlign: "right" }}>GST %</th>
                <th style={{ ...TH, textAlign: "right" }}>GST Amt</th>
                <th style={{ ...TH, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {segMealRows.length > 0 && segMealRows.map((row) => (
                <tr key={row.key}>
                  <td style={TD}>
                    {row.label}
                    <div style={{ fontSize: 10, color: "#52524a" }}>{row.dates}</div>
                  </td>
                  <td style={TD_NUM}>{fmt(row.rate)}</td>
                  <td style={TD_NUM}>{row.nights}</td>
                  <td style={TD_NUM}>{row.pax}</td>
                  <td style={TD_NUM}>{fmt(row.chg)}</td>
                  <td style={TD}></td><td style={TD}></td><td style={TD}></td><td style={TD}></td>
                  <td style={TD_NUM}>18%</td>
                  <td style={TD_NUM}>{fmt(row.chg * 0.18)}</td>
                  <td style={TD_NUM}>{fmt(row.chg * 1.18)}</td>
                </tr>
              ))}
              {segMealRows.length === 0 && b.mealOn && (
                <tr>
                  <td style={TD}>Meal &amp; Activity Package</td>
                  <td style={TD_NUM}>{b.adults && b.nights ? fmt(Math.round(mealOnlyCharges / b.nights / b.adults)) : "—"}</td>
                  <td style={TD_NUM}>{b.nights}</td>
                  <td style={TD_NUM}>{b.adults}</td>
                  <td style={TD_NUM}>{fmt(mealOnlyCharges)}</td>
                  <td style={TD}></td><td style={TD}></td><td style={TD}></td><td style={TD}></td>
                  <td style={TD_NUM}>18%</td>
                  <td style={TD_NUM}>{fmt(mealOnlyGst)}</td>
                  <td style={TD_NUM}>{fmt(mealOnlyCharges + mealOnlyGst)}</td>
                </tr>
              )}
              {segMealRows.length === 0 && (b.pets || 0) > 0 && (
                <tr>
                  <td style={TD}>Pet Package</td>
                  <td style={TD_NUM}>{b.pets && b.nights ? fmt(Math.round(petCharges / b.nights / b.pets)) : "—"}</td>
                  <td style={TD_NUM}>{b.nights}</td>
                  <td style={TD_NUM}>{b.pets}</td>
                  <td style={TD_NUM}>{fmt(petCharges)}</td>
                  <td style={TD}></td><td style={TD}></td><td style={TD}></td><td style={TD}></td>
                  <td style={TD_NUM}>18%</td>
                  <td style={TD_NUM}>{fmt(petGstAmt)}</td>
                  <td style={TD_NUM}>{fmt(totalPetAmt)}</td>
                </tr>
              )}
              {segMealRows.length === 0 && (b.driverMealOn ?? false) && (b.driverCount ?? 0) > 0 && (
                <tr>
                  <td style={TD}>Driver / Attendant Meal</td>
                  <td style={TD_NUM}>{b.driverCount && b.nights ? fmt(Math.round(driverMealCharges / b.nights / b.driverCount)) : "—"}</td>
                  <td style={TD_NUM}>{b.nights}</td>
                  <td style={TD_NUM}>{b.driverCount}</td>
                  <td style={TD_NUM}>{fmt(driverMealCharges)}</td>
                  <td style={TD}></td><td style={TD}></td><td style={TD}></td><td style={TD}></td>
                  <td style={TD_NUM}>18%</td>
                  <td style={TD_NUM}>{fmt(driverMealGstAmt)}</td>
                  <td style={TD_NUM}>{fmt(totalDriverMealAmt)}</td>
                </tr>
              )}
              <tr>
                <td style={TD_HEAD} colSpan={4}>Total Meal Charges</td>
                <td style={TD_HEAD_NUM}>{fmt(totalMealPetCharges)}</td>
                <td style={TD_HEAD}></td><td style={TD_HEAD}></td><td style={TD_HEAD}></td><td style={TD_HEAD}></td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD_NUM}>{fmt(totalMealPetGst)}</td>
                <td style={TD_HEAD_NUM}>{fmt(totalMealPet)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Add-on Charges */}
        {extras.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
            <thead>
              <tr>
                <th style={TH}>Add-on Charge</th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={{ ...TH, textAlign: "right" }}>Charges</th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={{ ...TH, textAlign: "right" }}>GST %</th>
                <th style={{ ...TH, textAlign: "right" }}>GST Amt</th>
                <th style={{ ...TH, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {extras.map((e, i) => {
                const gst = e.gst ?? 0;
                const pct = e.amount > 0 ? Math.round((gst / e.amount) * 100) : 0;
                return (
                  <tr key={i}>
                    <td style={TD}>{e.name}</td>
                    <td style={TD}></td><td style={TD}></td><td style={TD}></td>
                    <td style={TD_NUM}>{fmt(e.amount)}</td>
                    <td style={TD}></td><td style={TD}></td><td style={TD}></td><td style={TD}></td>
                    <td style={TD_NUM}>{pct}%</td>
                    <td style={TD_NUM}>{fmt(gst)}</td>
                    <td style={TD_NUM}>{fmt(e.amount + gst)}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={TD_HEAD} colSpan={4}>Total Add-on Charges</td>
                <td style={TD_HEAD_NUM}>{fmt(extrasBasic)}</td>
                <td style={TD_HEAD}></td><td style={TD_HEAD}></td><td style={TD_HEAD}></td><td style={TD_HEAD}></td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD_NUM}>{fmt(extrasGst)}</td>
                <td style={TD_HEAD_NUM}>{fmt(extrasTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Grand total + Advance + Balance */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
          <tbody>
            <tr>
              <td style={TD_GRAND} colSpan={10}>Total Amt Payable</td>
              <td style={TD_GRAND}></td>
              <td style={TD_GRAND_NUM}>{fmt(grandTotal)}</td>
            </tr>
            {(b.deductions ?? []).length > 0 && (() => {
              const dedTotal = (b.deductions ?? []).reduce((s, d) => s + d.amount + d.gst, 0);
              return (
                <>
                  {(b.deductions ?? []).map((d, i) => (
                    <tr key={i}>
                      <td style={TD} colSpan={11}>
                        Deduction — {d.type}
                      </td>
                      <td style={{ ...TD, textAlign: "right", color: "#b83232", fontWeight: 700 }}>−{fmt(d.amount + d.gst)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={TD_GRAND} colSpan={10}>Net Receivable</td>
                    <td style={TD_GRAND}></td>
                    <td style={TD_GRAND_NUM}>{fmt(grandTotal - dedTotal)}</td>
                  </tr>
                </>
              );
            })()}
            <tr>
              <td style={TD} colSpan={11}>
                <strong>Amount Received</strong>
              </td>
              <td style={TD_YELLOW}>{fmt(b.advance)}</td>
            </tr>
            <tr>
              <td style={TD} colSpan={11}>
                <strong>Balance Amount</strong>
              </td>
              <td style={TD_YELLOW}>{fmt(b.balance)}</td>
            </tr>
          </tbody>
        </table>

        {/* Meal Preference + Special Request */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ border: "1px solid #d0c9bc", padding: "10px 12px" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#52524a",
                textTransform: "uppercase",
                letterSpacing: ".5px",
                marginBottom: 4,
              }}
            >
              Meals
            </div>
            <div style={{ fontSize: 12, color: "#1a1a16" }}>
              {b.mealOn ? "Included" : "Not included"}
            </div>
          </div>
          <div style={{ border: "1px solid #d0c9bc", padding: "10px 12px" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: "#52524a",
                textTransform: "uppercase",
                letterSpacing: ".5px",
                marginBottom: 4,
              }}
            >
              Special Request
            </div>
            <div style={{ fontSize: 12, color: "#1a1a16" }}>{b.notes || "—"}</div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        body,
        html {
          background: #fff !important;
          overflow-y: auto !important;
          height: auto !important;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: #fff !important;
            overflow: visible !important;
          }
          /* A zero page margin leaves the browser no room to draw its own
             header and footer, so the print date, tab title, page number and
             source URL stay off the guest's copy. The margin the sheet needs
             is applied as padding instead. */
          @page {
            size: A4;
            margin: 0;
          }
          .confirmation-sheet {
            padding: 12mm 12mm !important;
            max-width: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function GuestRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        borderBottom: last ? "none" : "1px solid #d0c9bc",
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          background: "#f4f1ea",
          fontSize: 11,
          fontWeight: 700,
          color: "#52524a",
          borderRight: "1px solid #d0c9bc",
        }}
      >
        {label}
      </div>
      <div style={{ padding: "6px 10px", fontSize: 12, color: "#1a1a16", fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}
