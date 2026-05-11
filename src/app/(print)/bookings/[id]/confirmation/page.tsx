"use client";

import { useParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { fmt } from "@/lib/utils";
import type { PricingRow } from "@/types";

function formatLongPretty(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

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
const REX_TAG: React.CSSProperties = {
  background: "#fff3a3",
  padding: "2px 8px",
  borderRadius: 3,
  fontWeight: 700,
  fontSize: 11,
};

export default function ConfirmationPage() {
  const params = useParams<{ id: string }>();
  const { bookings, hydrated } = useApp();
  const id = params?.id;
  const b = bookings.find((x) => x.id === id);

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

  // Aggregates from pricingRows
  const totalRoomBaseCharges = b.pricingRows.reduce((s, r) => s + r.roomCharges, 0);
  const totalDiscount = b.pricingRows.reduce((s, r) => s + r.discountAmt, 0);
  const totalNet = b.pricingRows.reduce((s, r) => s + r.netCharges, 0);
  const totalRoomGst = b.pricingRows.reduce((s, r) => s + r.gstAmt, 0);
  const totalRoomAmt = b.pricingRows.reduce((s, r) => s + r.totalAmt, 0);
  const totalRooms = (() => {
    const m = new Map<string, number>();
    b.pricingRows.forEach((r) => {
      const prev = m.get(r.roomId) || 0;
      m.set(r.roomId, Math.max(prev, r.numRooms));
    });
    return Array.from(m.values()).reduce((s, n) => s + n, 0);
  })();
  const overallDiscPct =
    totalRoomBaseCharges > 0
      ? Math.round((totalDiscount / totalRoomBaseCharges) * 100)
      : 0;

  const mealCharges = b.mealOn ? b.mealTotal : 0;
  const mealGst = b.mealOn ? b.mealGst : 0;
  const totalMealAmt = mealCharges + mealGst;
  const petCharges = b.petTotal || 0;
  const petGstAmt = b.petGst || 0;
  const totalPetAmt = petCharges + petGstAmt;
  const totalMealPetCharges = mealCharges + petCharges;
  const totalMealPetGst = mealGst + petGstAmt;
  const totalMealPet = totalMealAmt + totalPetAmt;

  const grandTotal = totalRoomAmt + totalMealPet;
  const grandGst = totalRoomGst + totalMealPetGst;
  const grandRaw = totalRoomBaseCharges + totalMealPetCharges;

  const showMealTable = b.mealOn || (b.pets || 0) > 0;

  return (
    <div className="confirmation-root" style={{ background: "#fff", minHeight: "100vh" }}>
      {/* Print header */}
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
          🖨 Print / Download PDF
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
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 32px",
          fontFamily: "DM Sans, sans-serif",
          color: "#1a1a16",
        }}
      >
        {/* Letterhead */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "center", marginBottom: 12 }}>
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
              }}
            >
              RETREATS
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "Outfit, sans-serif",
                fontSize: 18,
                fontWeight: 800,
                color: "#0f2318",
              }}
            >
              BOOKING CONFIRMATION
            </div>
            <div style={{ fontSize: 11, color: "#52524a", marginTop: 3 }}>{b.id}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#52524a" }}>
            REX: <span style={REX_TAG}>{b.rex}</span>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#52524a", marginBottom: 4 }}>
          Survey Number 27-1, Canterbury Castles Layout, Oodanahalli, near Nandi Hills
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#1a1a16",
            marginBottom: 16,
          }}
        >
          Resort Contact - Please contact 80881 75568 for any assistance to reach the site.
        </div>

        {/* Guest info block */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 0,
            border: "1px solid #d0c9bc",
            marginBottom: 14,
          }}
        >
          <div>
            <GuestRow label="Guest Name" value={b.guest} />
            <GuestRow label="Mobile No." value={b.mobile} />
            <GuestRow label="Check-In Date" value={formatLongPretty(b.checkin)} />
            <GuestRow label="Check-Out Date" value={formatLongPretty(b.checkout)} />
            <GuestRow label="No. Of Nights" value={String(b.nights)} />
            <GuestRow
              label="Room Discount"
              value={`${b.nights} Nights | ${overallDiscPct}%`}
              last
            />
          </div>
          <div style={{ borderLeft: "1px solid #d0c9bc" }}>
            <GuestRow label="Adults" value={String(b.adults)} />
            <GuestRow label="Kids > 10 Yrs" value={String(b.kidsAbove10)} />
            <GuestRow label="Kids 6-10 Yrs" value={String(b.kids6to10)} />
            <GuestRow label="Kids 2-6 Yrs" value={String(b.kids2to6)} />
            <GuestRow label="Infant < 2 Yrs" value={String(b.infantsBelow2)} />
            <GuestRow label="Senior Citizens" value={String(b.seniors)} />
            <GuestRow label="Pets" value={String(b.pets)} last />
          </div>
        </div>

        {/* Accommodation Charges */}
        <div
          style={{
            background: "#0f2318",
            color: "#fff",
            padding: "8px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "Outfit, sans-serif",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: ".5px",
            textTransform: "uppercase",
          }}
        >
          <span>Accomodation Charges</span>
          <span style={{ fontSize: 11 }}>
            REX: <span style={REX_TAG}>{b.rex}</span>
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
          <thead>
            <tr>
              <th style={TH}>Room Category</th>
              <th style={{ ...TH, textAlign: "right" }}>Room Tariff</th>
              <th style={{ ...TH, textAlign: "right" }}>No. of Nights</th>
              <th style={{ ...TH, textAlign: "right" }}>No. of Rooms</th>
              <th style={{ ...TH, textAlign: "right" }}>Room Chgs</th>
              <th style={{ ...TH, textAlign: "right" }}>Discount Amt</th>
              <th style={{ ...TH, textAlign: "right" }}>Net Charges</th>
              <th style={{ ...TH, textAlign: "right" }}>GST Rate</th>
              <th style={{ ...TH, textAlign: "right" }}>GST Amt</th>
              <th style={{ ...TH, textAlign: "right" }}>Total Amt</th>
            </tr>
          </thead>
          <tbody>
            {b.pricingRows.length === 0 ? (
              <tr>
                <td style={{ ...TD, textAlign: "center" }} colSpan={10}>
                  No pricing rows
                </td>
              </tr>
            ) : (
              b.pricingRows.map((r: PricingRow, i: number) => (
                <tr key={i}>
                  <td style={TD}>{r.roomName}</td>
                  <td style={TD_NUM}>{fmt(r.tariff)}</td>
                  <td style={TD_NUM}>{r.nights}</td>
                  <td style={TD_NUM}>{r.numRooms}</td>
                  <td style={TD_NUM}>{fmt(r.roomCharges)}</td>
                  <td style={TD_NUM}>{r.discountAmt > 0 ? `− ${fmt(r.discountAmt)}` : "—"}</td>
                  <td style={TD_NUM}>{fmt(r.netCharges)}</td>
                  <td style={TD_NUM}>{r.gstRate}%</td>
                  <td style={TD_NUM}>{fmt(r.gstAmt)}</td>
                  <td style={TD_NUM}>{fmt(r.totalAmt)}</td>
                </tr>
              ))
            )}
            <tr>
              <td style={TD_HEAD}>Total Room Charges (A)</td>
              <td style={TD_HEAD}></td>
              <td style={TD_HEAD}></td>
              <td style={TD_HEAD_NUM}>{totalRooms}</td>
              <td style={TD_HEAD_NUM}>{fmt(totalRoomBaseCharges)}</td>
              <td style={TD_HEAD_NUM}>{totalDiscount > 0 ? `− ${fmt(totalDiscount)}` : "—"}</td>
              <td style={TD_HEAD_NUM}>{fmt(totalNet)}</td>
              <td style={TD_HEAD}></td>
              <td style={TD_HEAD_NUM}>{fmt(totalRoomGst)}</td>
              <td style={TD_HEAD_NUM}>{fmt(totalRoomAmt)}</td>
            </tr>
          </tbody>
        </table>

        {/* Meal/Pet Charges */}
        {showMealTable && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
            <thead>
              <tr>
                <th style={TH}>Meal Charges</th>
                <th style={{ ...TH, textAlign: "right" }}>Meal Tariff</th>
                <th style={{ ...TH, textAlign: "right" }}>No. of Nights</th>
                <th style={{ ...TH, textAlign: "right" }}>No. of Pax</th>
                <th style={{ ...TH, textAlign: "right" }}>Meal Chgs</th>
                <th style={TH}></th>
                <th style={TH}></th>
                <th style={{ ...TH, textAlign: "right" }}>GST Rate</th>
                <th style={{ ...TH, textAlign: "right" }}>GST Amt</th>
                <th style={{ ...TH, textAlign: "right" }}>Total Amt</th>
              </tr>
            </thead>
            <tbody>
              {b.mealOn && (
                <tr>
                  <td style={TD}>Meal &amp; Activity Package</td>
                  <td style={TD_NUM}>{fmt(2100)}</td>
                  <td style={TD_NUM}>{b.nights}</td>
                  <td style={TD_NUM}>{b.adults}</td>
                  <td style={TD_NUM}>{fmt(mealCharges)}</td>
                  <td style={TD}></td>
                  <td style={TD}></td>
                  <td style={TD_NUM}>18%</td>
                  <td style={TD_NUM}>{fmt(mealGst)}</td>
                  <td style={TD_NUM}>{fmt(totalMealAmt)}</td>
                </tr>
              )}
              {(b.pets || 0) > 0 && (
                <tr>
                  <td style={TD}>Pet Package</td>
                  <td style={TD_NUM}>{fmt(1200)}</td>
                  <td style={TD_NUM}>{b.nights}</td>
                  <td style={TD_NUM}>{b.pets}</td>
                  <td style={TD_NUM}>{fmt(petCharges)}</td>
                  <td style={TD}></td>
                  <td style={TD}></td>
                  <td style={TD_NUM}>18%</td>
                  <td style={TD_NUM}>{fmt(petGstAmt)}</td>
                  <td style={TD_NUM}>{fmt(totalPetAmt)}</td>
                </tr>
              )}
              <tr>
                <td style={TD_HEAD}>Total Meal Charges (B)</td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD_NUM}>{fmt(totalMealPetCharges)}</td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD}></td>
                <td style={TD_HEAD_NUM}>{fmt(totalMealPetGst)}</td>
                <td style={TD_HEAD_NUM}>{fmt(totalMealPet)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Grand total + Advance + Balance */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
          <tbody>
            <tr>
              <td style={TD_GRAND}>Total Amt Payable (A + B)</td>
              <td style={TD_GRAND_NUM}>{fmt(grandRaw)}</td>
              <td style={TD_GRAND}></td>
              <td style={TD_GRAND}></td>
              <td style={TD_GRAND_NUM}>{fmt(grandGst)}</td>
              <td style={TD_GRAND_NUM}>{fmt(grandTotal)}</td>
            </tr>
            <tr>
              <td style={TD} colSpan={5}>
                <strong>Advance Amount Paid</strong>
              </td>
              <td style={TD_YELLOW}>{fmt(b.advance)}</td>
            </tr>
            <tr>
              <td style={TD} colSpan={5}>
                <strong>Balance Amount Payable at the time of Check-In</strong>
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
              Meal Preference
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

        {/* Policies */}
        <div
          style={{
            background: "#0f2318",
            color: "#fff",
            padding: "8px 12px",
            fontFamily: "Outfit, sans-serif",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: ".5px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Policies
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            fontSize: 10.5,
            color: "#1a1a16",
            lineHeight: 1.5,
          }}
        >
          <div>
            <PolicyHeading>Check-in &amp; Check-out Timings</PolicyHeading>
            <PolicyList
              items={[
                "Standard check-in time is 2 PM & check-out time is 11 AM.",
                "Early check-in & late check-out is subject to availability. No early check-in & late check-out on Saturdays.",
                "Guests can arrive at 1 PM & have lunch, but room allocation will be done at 2 PM.",
                "In case guests are staying for lunch on the day of check-out, rooms will have to be vacated at 11AM.",
              ]}
            />

            <PolicyHeading>Meal Package</PolicyHeading>
            <PolicyList
              items={[
                "Meal package includes buffet lunch, high tea, BBQ, dinner on the day of check-in and morning tea & breakfast on the day of check-out.",
                "We do not serve a-la-carte menu.",
                "We do not provide room service / table service.",
                "We provide only chicken in non-veg, we do not provide fish or mutton.",
                "Buffet lunch counter closes at 3PM. Limited lunch menu items can be provided between 3-4 PM.",
                "We do not provide liquor. Soft drinks & soda is provided.",
              ]}
            />

            <PolicyHeading>Activities Included in the Package</PolicyHeading>
            <PolicyList
              items={[
                "Adventure Course | Air Rifle Firing | Morning Trek | Nature walk | Swimming Pool",
                "Cycling, Volleyball, Cricket, Indoor Games (Table Tennis, Foosball, Snooker, Carrom & Board Games)",
                "Activities are subject to weather conditions.",
                "Transportation to trek starting point should be arranged by guests themselves. We do not provide the same.",
                "VAMA is absolved from any risk of injury in outdoor activities.",
              ]}
            />

            <PolicyHeading>Driver / Attendant Policies</PolicyHeading>
            <PolicyList
              items={[
                "Accommodation & bedding is provided free of cost for drivers/attendants. They must carry their own towels / toiletries.",
                "Meal charges of Rs.1500 will apply in case drivers/attendants want to have guest food.",
                "Driver/attendants are not permitted for activities.",
              ]}
            />

            <PolicyHeading>Parking</PolicyHeading>
            <PolicyList
              items={["Surface parking is available. However, the same is at the owner's risk."]}
            />
          </div>

          <div>
            <PolicyHeading>Items to Carry</PolicyHeading>
            <PolicyList
              items={[
                "Pls carry Swimwear, sport shoes, track pants, sun cap, warm / rain jacket, umbrella.",
                "Pls carry your own Toothbrush, toothpaste and shaving kit. Bath gel, shampoo & Bath towel is provided by VAMA.",
                "Sports shoes / sneakers is mandatory to participate in adventure course & trekking.",
              ]}
            />

            <PolicyHeading>Pet Policy</PolicyHeading>
            <PolicyList
              items={[
                "Pet Meal Package includes Rice, Curd, Boiled Vegetables, Boiled Eggs, Boiled Chicken and Chicken Broth. We do not provide Mutton, Fish & Dry Pet Food.",
                "Pet should be kept on leash in common areas.",
                "Pet owners should carry their own Pet Food Bowls & Poop Sticks.",
                "A maximum of 2 pets are allowed in each Villa.",
              ]}
            />

            <PolicyHeading>Swimming Pool | Timing 8 AM - 8 PM</PolicyHeading>
            <PolicyList
              items={[
                "Usage of Swimming Pool is strictly in swimwear only. No T-Shirts, Dry Fits, Track Pants, Salwar Kameez, Sarees etc.",
                "We DO NOT provide head cap. Ladies should carry their own head caps.",
              ]}
            />

            <PolicyHeading>Payment Policies</PolicyHeading>
            <PolicyList
              items={[
                "Balance Amount must be paid at the time of check-in, since we do not take credit card guarantee.",
                "All adult guests will need to share mobile no. / photo ID at the time of check-in.",
                "GST Invoice will be provided on request within 2 working days of check-out date. Pls note that GST is paid by us on all payments received.",
              ]}
            />

            <PolicyHeading>General Rules</PolicyHeading>
            <PolicyList
              items={[
                "Pls note that there is 200 meters distance between our villas and dining area.",
                "1 BHK Garden Villas have a common garden between 2 villas.",
                "Guests should refrain from playing own music in common areas.",
                "In case of disturbance to other guests, music volume will need to be lowered.",
                "Firecrackers and Confetti are not allowed.",
                "Decoration inside and outside the villas is not allowed.",
                "Drones are not allowed over swimming pool & pool villa.",
              ]}
            />
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
          @page {
            margin: 12mm;
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

function PolicyHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "Outfit, sans-serif",
        fontSize: 11,
        fontWeight: 800,
        color: "#0f2318",
        textTransform: "uppercase",
        letterSpacing: ".4px",
        marginTop: 10,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function PolicyList({ items }: { items: string[] }) {
  return (
    <ol style={{ paddingLeft: 18, margin: 0 }}>
      {items.map((t, i) => (
        <li key={i} style={{ marginBottom: 2 }}>
          {t}
        </li>
      ))}
    </ol>
  );
}
