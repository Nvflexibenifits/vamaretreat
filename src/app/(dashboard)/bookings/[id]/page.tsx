"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const { bookings, roomInventory, openModal, hydrated, currentRole } = useApp();
  const isFrontOffice = currentRole === "Front Office";
  const b = bookings.find((x) => x.id === id);

  useEffect(() => {
    if (!hydrated) return;
    if (id && !b) router.replace("/bookings");
  }, [b, id, router, hydrated]);

  if (!b) return null;

  const canConfirm = !isFrontOffice && (b.status === "Enquiry" || b.status === "Tentative");
  const canLost = !isFrontOffice && (b.status === "Enquiry" || b.status === "Tentative" || b.status === "Confirmed");
  const canPay = !isFrontOffice && b.status === "Confirmed" && b.balance > 0;
  const canComplete = !isFrontOffice && b.status === "Confirmed";
  const canEdit = !isFrontOffice && (b.status === "Enquiry" || b.status === "Tentative" || b.status === "Confirmed" || b.status === "Completed");
  const editLabel = b.status === "Completed" ? "Add Expenses" : "Edit";

  const totalCollected =
    b.payments.reduce((s, p) => s + p.amount, 0) +
    b.extras.reduce((s, e) => s + (e.totalPaid ?? e.amount + (e.gst ?? 0)), 0);

  const totalKids = b.kidsAbove10 + b.kids6to10 + b.kids2to6;
  const totalRoomBaseCharges = b.pricingRows.reduce((s, r) => s + r.roomCharges, 0);
  const totalDiscount = b.pricingRows.reduce((s, r) => s + r.discountAmt, 0);
  const totalNet = b.pricingRows.reduce((s, r) => s + r.netCharges, 0);
  const totalRoomGst = b.pricingRows.reduce((s, r) => s + r.gstAmt, 0);
  const totalMealPet = b.mealTotal + b.mealGst + b.petTotal + b.petGst + (b.driverMealTotal ?? 0) + (b.driverMealGst ?? 0);
  const totalGstAll = totalRoomGst + b.mealGst + b.petGst + (b.driverMealGst ?? 0);

  const roomsSummary = (() => {
    const m = new Map<string, number>();
    b.pricingRows.forEach((r) => {
      const prev = m.get(r.roomName) || 0;
      m.set(r.roomName, Math.max(prev, r.numRooms));
    });
    return Array.from(m.entries())
      .map(([name, qty]) => name + (qty > 1 ? ` ×${qty}` : ""))
      .join(", ");
  })();

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>{b.guest}</h2>
          <p>
            {b.id} · {fmtIN(b.checkin)} to {fmtIN(b.checkout)} · {b.nights} night{b.nights !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/bookings" className="btn btn-ghost btn-sm">Back to All Bookings</Link>
      </div>

      <div>
        <div className="status-bar">
          <span><StatusBadge status={b.status} /></span>
          {b.allocatedRooms.length > 0 && (
            <span className="badge" style={{ background: "var(--blu-bg)", color: "var(--blu)" }}>
              Room: {b.allocatedRooms.join(", ")}
            </span>
          )}
          {b.status === "Lost" && b.lostReason && (
            <span style={{ fontSize: 12, color: "var(--red)" }}>Reason: {b.lostReason}</span>
          )}
          <div className="status-actions">
            {canConfirm && (
              <button
                className="btn btn-accent btn-sm"
                onClick={() => openModal({ kind: "payment", bookingId: b.id })}
              >
                Confirm + Record Payment
              </button>
            )}
            {canPay && (
              <button
                className="btn btn-success btn-sm"
                onClick={() => openModal({ kind: "payment", bookingId: b.id })}
              >
                Record Payment
              </button>
            )}
            {canComplete && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => openModal({ kind: "complete", bookingId: b.id })}
              >
                Checkout &amp; Complete
              </button>
            )}
            {canLost && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => openModal({ kind: "lost", bookingId: b.id })}
              >
                Mark Lost
              </button>
            )}
            {canEdit && (
              <Link href={`/bookings/${b.id}/edit`} className="btn btn-ghost btn-sm">
                {editLabel}
              </Link>
            )}
            <a
              className="btn btn-ghost btn-sm"
              href={`/bookings/${b.id}/confirmation`}
              target="_blank"
              rel="noreferrer"
            >
              View Pricing Sheet
            </a>
          </div>
        </div>

        <div className="detail-layout">
          <div>
            <div className="detail-panel">
              <div className="detail-panel-hd"><h3>Guest &amp; Booking</h3></div>
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
                <div className="detail-row"><span className="detail-key">Rooms</span><span className="detail-val">{roomsSummary || "—"}</span></div>
                <div className="detail-row"><span className="detail-key">Meal Package</span><span className="detail-val">{b.mealOn ? "Included" : "Not included"}</span></div>
                <div className="detail-row"><span className="detail-key">Notes</span><span className="detail-val" style={{ color: "var(--t2)" }}>{b.notes || "—"}</span></div>
                <div className="detail-row"><span className="detail-key">Booking by</span><span className="detail-val">{b.rex}</span></div>
              </div>
            </div>

            {b.nightOverrides && b.nightOverrides.length > 0 && (
              <div className="detail-panel">
                <div className="detail-panel-hd">
                  <h3>Room Reassignments</h3>
                </div>
                <div className="detail-panel-body">
                  {[...b.nightOverrides]
                    .sort((a, b2) => (a.date < b2.date ? -1 : 1))
                    .map((o) => {
                      const fromInv = roomInventory.find(
                        (r) => r.id === o.fromRoomId
                      );
                      const toInv = roomInventory.find(
                        (r) => r.id === o.toRoomId
                      );
                      return (
                        <div
                          key={`${o.date}-${o.fromRoomId}`}
                          style={{
                            padding: "10px 0",
                            borderBottom: "1px solid var(--bd)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontFamily:
                                  "var(--font-outfit), Outfit, sans-serif",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--t1)",
                              }}
                            >
                              {fmtIN(o.date)}
                            </span>
                            {o.upgrade ? (
                              o.upgrade.kind === "complimentary" ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: "var(--grn-bg)",
                                    color: "var(--grn)",
                                  }}
                                >
                                  Complimentary Upgrade
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    background: "var(--amb-bg)",
                                    color: "var(--amb)",
                                  }}
                                >
                                  Paid Upgrade
                                </span>
                              )
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  background: "var(--surf3)",
                                  color: "var(--t2)",
                                }}
                              >
                                Room Swap (Same Category)
                              </span>
                            )}
                          </div>
                          <div className="detail-row">
                            <span className="detail-key">Originally Booked</span>
                            <span className="detail-val">
                              {fromInv?.label || o.fromRoomId}
                              {o.upgrade
                                ? ` (${o.upgrade.fromCategoryName})`
                                : fromInv
                                ? ` (${fromInv.type})`
                                : ""}
                            </span>
                          </div>
                          <div className="detail-row">
                            <span className="detail-key">Reassigned To</span>
                            <span
                              className="detail-val"
                              style={{ fontWeight: 600 }}
                            >
                              {toInv?.label || o.toRoomId}
                              {o.upgrade
                                ? ` (${o.upgrade.toCategoryName})`
                                : toInv
                                ? ` (${toInv.type})`
                                : ""}
                            </span>
                          </div>
                          {o.upgrade && o.upgrade.kind === "complimentary" && (
                            <div className="detail-row">
                              <span className="detail-key">Reason</span>
                              <span
                                className="detail-val"
                                style={{ color: "var(--t2)" }}
                              >
                                {o.upgrade.reason || "—"}
                              </span>
                            </div>
                          )}
                          {o.upgrade && o.upgrade.kind === "paid" && (
                            <div className="detail-row">
                              <span className="detail-key">Upgrade Charge</span>
                              <span
                                className="detail-val"
                                style={{
                                  fontWeight: 700,
                                  color: "var(--amb)",
                                }}
                              >
                                {fmt(o.upgrade.extraAmount)}
                              </span>
                            </div>
                          )}
                          {o.upgrade && (
                            <div className="detail-row">
                              <span className="detail-key">Updated</span>
                              <span className="detail-val">
                                {fmtIN(o.upgrade.upgradeDate)} by {o.upgrade.by}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="detail-panel">
              <div className="detail-panel-hd"><h3>Price Breakdown</h3></div>
              <div className="detail-panel-body">
                <div className="detail-row"><span className="detail-key">Room Charges</span><span className="detail-val">{fmt(totalRoomBaseCharges)}</span></div>
                {totalDiscount > 0 && (
                  <div className="detail-row"><span className="detail-key">Discount</span><span className="detail-val" style={{ color: "var(--amb)" }}>− {fmt(totalDiscount)}</span></div>
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
                    .filter(
                      (o) => o.upgrade && o.upgrade.kind === "paid"
                    )
                    .reduce(
                      (s, o) => s + (o.upgrade?.extraAmount || 0),
                      0
                    );
                  if (upgradeTotal <= 0) return null;
                  return (
                    <div className="detail-row">
                      <span className="detail-key">Room Upgrade Charges</span>
                      <span
                        className="detail-val"
                        style={{ fontWeight: 600, color: "var(--amb)" }}
                      >
                        {fmt(upgradeTotal)}
                      </span>
                    </div>
                  );
                })()}
                {(() => {
                  const nonUpgradeExtras = b.extras.filter(
                    (e) => !e.name.startsWith("Room Upgrade")
                  );
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
                <div className="detail-row"><span className="detail-key">Advance Paid</span><span className="detail-val" style={{ color: "var(--grn)" }}>{fmt(b.advance)}</span></div>
                <div
                  className="detail-row"
                  style={{ background: b.balance > 0 ? "var(--amb-lt)" : "var(--grn-lt)" }}
                >
                  <span className="detail-key" style={{ fontWeight: 600 }}>{b.balance > 0 ? "Balance Due" : "Fully Paid"}</span>
                  <span className="detail-val" style={{ fontWeight: 700, color: b.balance > 0 ? "var(--amb)" : "var(--grn)" }}>
                    {b.balance > 0 ? fmt(b.balance) : "Paid"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="trail">
              <div className="trail-hd">
                <div className="trail-hd-title">Audit Trail</div>
                <div className="trail-hd-id">{b.id}</div>
              </div>
              {b.payments.map((p, i) => (
                <div key={i} className="trail-item">
                  <div className="t-dot t-grn"></div>
                  <div className="t-time">{fmtIN(p.date)}</div>
                  <div className="t-lbl"><strong>{p.type}</strong> — {p.mode}</div>
                  {p.amount > 0 && <div className="t-amt">{fmt(p.amount)}</div>}
                  <div className="t-by">{p.by}</div>
                </div>
              ))}
              {b.extras.map((e, i) => (
                <div key={`e-${i}`} className="trail-item">
                  <div className="t-dot t-amb"></div>
                  <div className="t-time">{fmtIN(e.date || b.checkout)}</div>
                  <div className="t-lbl">
                    <strong>Extra: {e.name}</strong>
                    {e.gst ? <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: 6 }}>+{fmt(e.gst)} GST</span> : null}
                  </div>
                  <div className="t-amt">{fmt(e.totalPaid ?? e.amount + (e.gst ?? 0))}</div>
                  <div className="t-by">{e.by || b.rex}</div>
                </div>
              ))}
              {(b.nightOverrides || [])
                .filter((o) => o.upgrade && o.upgrade.kind === "complimentary")
                .sort((a, b2) => (a.date < b2.date ? -1 : 1))
                .map((o) => (
                  <div
                    key={`up-${o.date}-${o.fromRoomId}`}
                    className="trail-item"
                  >
                    <div className="t-dot t-grn"></div>
                    <div className="t-time">{fmtIN(o.upgrade!.upgradeDate)}</div>
                    <div className="t-lbl">
                      <strong>
                        Room Upgrade ({fmtIN(o.date)}, Complimentary):{" "}
                        {o.upgrade!.fromCategoryName} → {o.upgrade!.toCategoryName}
                      </strong>
                      {o.upgrade!.reason ? ` — ${o.upgrade!.reason}` : ""}
                    </div>
                    <div className="t-by">{o.upgrade!.by}</div>
                  </div>
                ))}
              {b.allocatedRooms.length > 0 && (
                <div className="trail-item">
                  <div className="t-dot t-blu"></div>
                  <div className="t-time">—</div>
                  <div className="t-lbl"><strong>Room Allocated</strong> — {b.allocatedRooms.join(", ")}</div>
                  <div className="t-by">Rahul</div>
                </div>
              )}
              {b.status === "Lost" && (
                <div className="trail-item">
                  <div className="t-dot t-red"></div>
                  <div className="t-time">—</div>
                  <div className="t-lbl"><strong>Marked Lost</strong>{b.lostReason ? ` — ${b.lostReason}` : ""}</div>
                  <div className="t-by">{b.rex}</div>
                </div>
              )}
              <div className="trail-total">
                <div className="trail-total-lbl">Total Collected</div>
                <div className="trail-total-val">{fmt(totalCollected)}</div>
              </div>
              <div className="trail-total" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
                <div className="trail-total-lbl">Total Booking Value</div>
                <div className="trail-total-val">{fmt(b.grandTotal)}</div>
              </div>
              {totalMealPet > 0 && (
                <div className="trail-total" style={{ borderTop: "1px solid rgba(255,255,255,.04)" }}>
                  <div className="trail-total-lbl">Meal &amp; Pet Total</div>
                  <div className="trail-total-val">{fmt(totalMealPet)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
