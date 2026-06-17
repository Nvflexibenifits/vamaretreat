"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const { bookings, roomInventory, openModal, updateBooking, hydrated, currentRole } = useApp();
  const isFrontOffice = currentRole === "Front Office";
  const b = bookings.find((x) => x.id === id);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (id && !b) router.replace("/bookings");
  }, [b, id, router, hydrated]);

  if (!b) return null;

  const canEdit = !isFrontOffice && (b.status === "Enquiry" || b.status === "Tentative" || b.status === "Confirmed" || b.status === "Completed");
  const showMarkLost = !isFrontOffice && (b.status === "Enquiry" || b.status === "Tentative");
  const showCancel = !isFrontOffice && b.status === "Confirmed";

  const totalKids = b.kidsAbove10 + b.kids6to10 + b.kids2to6;
  const totalRoomBaseCharges = b.pricingRows.reduce((s, r) => s + r.roomCharges, 0);
  const totalDiscount = b.pricingRows.reduce((s, r) => s + r.discountAmt, 0);
  const totalNet = b.pricingRows.reduce((s, r) => s + r.netCharges, 0);
  const totalRoomGst = b.pricingRows.reduce((s, r) => s + r.gstAmt, 0);
  const totalGstAll = totalRoomGst + b.mealGst + b.petGst + (b.driverMealGst ?? 0);

  const roomCategoryMap = (() => {
    const m = new Map<string, number>();
    b.pricingRows.forEach((r) => {
      m.set(r.roomName, Math.max(m.get(r.roomName) ?? 0, r.numRooms));
    });
    return m;
  })();

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>{b.guest}</h2>
          <p>{b.id}</p>
        </div>
        <Link href="/bookings" className="btn btn-ghost btn-sm">Back to Booking List</Link>
      </div>

      <div>
        <div className="status-bar">
          <span><StatusBadge status={b.status} /></span>
          {b.status === "Lost" && b.lostReason && (
            <span style={{ fontSize: 12, color: "var(--red)" }}>Reason: {b.lostReason}</span>
          )}
          <div className="status-actions">
            {canEdit && (
              <Link href={`/bookings/${b.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
            )}
            <a
              className="btn btn-ghost btn-sm"
              href={`/bookings/${b.id}/confirmation`}
              target="_blank"
              rel="noreferrer"
            >
              View Pricing
            </a>
            {showMarkLost && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => openModal({ kind: "lost", bookingId: b.id })}
              >
                Mark Lost
              </button>
            )}
            {showCancel && !cancelConfirm && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setCancelConfirm(true)}
              >
                Cancel
              </button>
            )}
            {showCancel && cancelConfirm && (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--t2)" }}>Confirm cancel?</span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    updateBooking(b.id, { status: "Cancelled" });
                    setCancelConfirm(false);
                  }}
                >
                  Yes, Cancel
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCancelConfirm(false)}>
                  No
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Two-column: Booking Data | Price Breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, alignItems: "start" }}>
          <div className="detail-panel">
            <div className="detail-panel-hd"><h3>Booking Data</h3></div>
            <div className="detail-panel-body">
              <div className="detail-row"><span className="detail-key">Guest Name</span><span className="detail-val">{b.guest}</span></div>
              <div className="detail-row"><span className="detail-key">Mobile</span><span className="detail-val">{b.mobile}</span></div>
              {b.email && (
                <div className="detail-row"><span className="detail-key">Email</span><span className="detail-val">{b.email}</span></div>
              )}
              <div className="detail-row"><span className="detail-key">Source</span><span className="detail-val">{b.source || "—"}</span></div>
              <div className="detail-row"><span className="detail-key">Check-in</span><span className="detail-val">{fmtIN(b.checkin)}</span></div>
              <div className="detail-row"><span className="detail-key">Check-out</span><span className="detail-val">{fmtIN(b.checkout)}</span></div>
              <div className="detail-row"><span className="detail-key">Nights</span><span className="detail-val">{b.nights}</span></div>
              <div className="detail-row">
                <span className="detail-key">Guests</span>
                <span className="detail-val">
                  {b.adults} Adults
                  {totalKids > 0 ? `, ${totalKids} Kids` : ""}
                  {b.seniors > 0 ? `, ${b.seniors} Seniors` : ""}
                  {b.pets > 0 ? `, ${b.pets} Pets` : ""}
                </span>
              </div>
              <div className="detail-row"><span className="detail-key">Meal Package</span><span className="detail-val">{b.mealOn ? "Included" : "Not included"}</span></div>
              <div className="detail-row">
                <span className="detail-key">Special Request</span>
                <span className="detail-val" style={{ color: "var(--t2)" }}>{b.notes || "—"}</span>
              </div>
            </div>
          </div>

          <div className="detail-panel">
            <div className="detail-panel-hd"><h3>Price Breakdown</h3></div>
            <div className="detail-panel-body">
              <div className="detail-row"><span className="detail-key">Room Charges</span><span className="detail-val">{fmt(totalRoomBaseCharges)}</span></div>
              {totalDiscount > 0 && (
                <div className="detail-row">
                  <span className="detail-key">Discount</span>
                  <span className="detail-val" style={{ color: "var(--amb)" }}>− {fmt(totalDiscount)}</span>
                </div>
              )}
              <div className="detail-row"><span className="detail-key">Net Room Charges</span><span className="detail-val">{fmt(totalNet)}</span></div>
              {b.mealTotal > 0 && (
                <div className="detail-row"><span className="detail-key">Meal Package</span><span className="detail-val">{fmt(b.mealTotal)}</span></div>
              )}
              {b.petTotal > 0 && (
                <div className="detail-row"><span className="detail-key">Pet Package</span><span className="detail-val">{fmt(b.petTotal)}</span></div>
              )}
              {(b.driverMealTotal ?? 0) > 0 && (
                <div className="detail-row"><span className="detail-key">Driver / Attendant Meal</span><span className="detail-val">{fmt(b.driverMealTotal!)}</span></div>
              )}
              <div className="detail-row"><span className="detail-key">GST</span><span className="detail-val">{fmt(totalGstAll)}</span></div>
              {(() => {
                const upgradeTotal = (b.nightOverrides || [])
                  .filter((o) => o.upgrade && o.upgrade.kind === "paid")
                  .reduce((s, o) => s + (o.upgrade?.extraAmount || 0), 0);
                if (upgradeTotal <= 0) return null;
                return (
                  <div className="detail-row">
                    <span className="detail-key">Room Upgrade Charges</span>
                    <span className="detail-val" style={{ fontWeight: 600, color: "var(--amb)" }}>
                      {fmt(upgradeTotal)}
                    </span>
                  </div>
                );
              })()}
              {(() => {
                const nonUpgradeExtras = b.extras.filter((e) => !e.name.startsWith("Room Upgrade"));
                if (nonUpgradeExtras.length === 0) return null;
                return (
                  <div className="detail-row">
                    <span className="detail-key">Extras</span>
                    <span className="detail-val">
                      {fmt(nonUpgradeExtras.reduce((s, e) => s + e.amount, 0))}
                    </span>
                  </div>
                );
              })()}
              <div className="detail-row" style={{ background: "var(--surf2)" }}>
                <span className="detail-key" style={{ fontWeight: 700, color: "var(--t1)" }}>Total Payable</span>
                <span className="detail-val" style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 16, fontWeight: 800 }}>{fmt(b.grandTotal)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-key">Advance Paid</span>
                <span className="detail-val" style={{ color: "var(--grn)" }}>{fmt(b.advance)}</span>
              </div>
              <div className="detail-row" style={{ background: b.balance > 0 ? "var(--amb-lt)" : "var(--grn-lt)" }}>
                <span className="detail-key" style={{ fontWeight: 600 }}>{b.balance > 0 ? "Balance Due" : "Fully Paid"}</span>
                <span className="detail-val" style={{ fontWeight: 700, color: b.balance > 0 ? "var(--amb)" : "var(--grn)" }}>
                  {b.balance > 0 ? fmt(b.balance) : "Paid"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Room Category & No's */}
        {roomCategoryMap.size > 0 && (
          <div className="detail-panel" style={{ marginTop: 16 }}>
            <div className="detail-panel-hd"><h3>Room Category & No's</h3></div>
            <div className="detail-panel-body">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {Array.from(roomCategoryMap.entries()).map(([name, qty]) => (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                      padding: "8px 18px",
                      background: "var(--surf2)",
                      border: "1px solid var(--bd)",
                      borderRadius: "var(--r2)",
                    }}
                  >
                    <span style={{ fontWeight: 500, color: "var(--t1)", fontSize: 14 }}>{name}</span>
                    <span style={{
                      fontFamily: "var(--font-outfit), Outfit, sans-serif",
                      fontWeight: 800,
                      fontSize: 18,
                      color: "var(--acc)",
                    }}>
                      ×{qty}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Room Reassignments */}
        {b.nightOverrides && b.nightOverrides.length > 0 && (
          <div className="detail-panel" style={{ marginTop: 16 }}>
            <div className="detail-panel-hd"><h3>Room Reassignments</h3></div>
            <div className="detail-panel-body">
              {[...b.nightOverrides]
                .sort((a, b2) => (a.date < b2.date ? -1 : 1))
                .map((o) => {
                  const fromInv = roomInventory.find((r) => r.id === o.fromRoomId);
                  const toInv = roomInventory.find((r) => r.id === o.toRoomId);
                  return (
                    <div
                      key={`${o.date}-${o.fromRoomId}`}
                      style={{ padding: "10px 0", borderBottom: "1px solid var(--bd)" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>
                          {fmtIN(o.date)}
                        </span>
                        {o.upgrade ? (
                          o.upgrade.kind === "complimentary" ? (
                            <span className="badge" style={{ background: "var(--grn-bg)", color: "var(--grn)" }}>Complimentary Upgrade</span>
                          ) : (
                            <span className="badge" style={{ background: "var(--amb-bg)", color: "var(--amb)" }}>Paid Upgrade</span>
                          )
                        ) : (
                          <span className="badge" style={{ background: "var(--surf3)", color: "var(--t2)" }}>Room Swap (Same Category)</span>
                        )}
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">Originally Booked</span>
                        <span className="detail-val">
                          {fromInv?.label || o.fromRoomId}
                          {o.upgrade ? ` (${o.upgrade.fromCategoryName})` : fromInv ? ` (${fromInv.type})` : ""}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-key">Reassigned To</span>
                        <span className="detail-val" style={{ fontWeight: 600 }}>
                          {toInv?.label || o.toRoomId}
                          {o.upgrade ? ` (${o.upgrade.toCategoryName})` : toInv ? ` (${toInv.type})` : ""}
                        </span>
                      </div>
                      {o.upgrade && o.upgrade.kind === "complimentary" && (
                        <div className="detail-row">
                          <span className="detail-key">Reason</span>
                          <span className="detail-val" style={{ color: "var(--t2)" }}>{o.upgrade.reason || "—"}</span>
                        </div>
                      )}
                      {o.upgrade && o.upgrade.kind === "paid" && (
                        <div className="detail-row">
                          <span className="detail-key">Upgrade Charge</span>
                          <span className="detail-val" style={{ fontWeight: 700, color: "var(--amb)" }}>
                            {fmt(o.upgrade.extraAmount)}
                          </span>
                        </div>
                      )}
                      {o.upgrade && (
                        <div className="detail-row">
                          <span className="detail-key">Updated</span>
                          <span className="detail-val">{fmtIN(o.upgrade.upgradeDate)} by {o.upgrade.by}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
