"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ROOMS } from "@/lib/data";
import { fmt, isWeekend, maxDiscountForRole, nightsBetween, nowTime, todayStr } from "@/lib/utils";
import type { Booking } from "@/types";

type Errors = { name?: boolean; mobile?: boolean; checkin?: boolean; checkout?: boolean };

function getInitialDates() {
  const ci = new Date();
  ci.setDate(ci.getDate() + 1);
  const co = new Date();
  co.setDate(co.getDate() + 2);
  return {
    ci: ci.toISOString().split("T")[0],
    co: co.toISOString().split("T")[0],
  };
}

export default function NewBookingPage() {
  const router = useRouter();
  const { currentRole, currentUser, bookings, createBooking, openModal, showNotif } = useApp();
  const maxDisc = maxDiscountForRole(currentRole);

  // Form state
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("WhatsApp");
  const [adults, setAdults] = useState("2");
  const [k1, setK1] = useState("0");
  const [k2, setK2] = useState("0");
  const [k3, setK3] = useState("0");
  const [infants, setInfants] = useState("0");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [roomQtys, setRoomQtys] = useState<Record<string, string>>(
    Object.fromEntries(ROOMS.map((r) => [r.id, "0"]))
  );
  const [mealOn, setMealOn] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [advance, setAdvance] = useState("0");
  const [paymode, setPaymode] = useState("UPI / QR");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    const { ci, co } = getInitialDates();
    setCheckin(ci);
    setCheckout(co);
  }, []);

  const nights = nightsBetween(checkin, checkout);
  const wknd = checkin ? isWeekend(checkin) : false;
  const rateType = wknd ? "Weekend" : "Weekday";

  const adultsN = parseInt(adults) || 0;
  const advN = parseInt(advance) || 0;
  const discPct = Math.min(parseInt(discount) || 0, maxDisc);

  const calc = useMemo(() => {
    let roomTotal = 0;
    const subs: Record<string, number> = {};
    ROOMS.forEach((r) => {
      const qty = parseInt(roomQtys[r.id] || "0") || 0;
      const rate = (wknd ? r.wknd : r.wd) * nights * qty;
      subs[r.id] = rate;
      roomTotal += rate;
    });
    const discAmt = roomTotal * (discPct / 100);
    const netRoom = roomTotal - discAmt;
    const gstRoom = netRoom * 0.18;
    const mealBase = mealOn ? adultsN * 2100 * nights : 0;
    const mealGst = mealBase * 0.18;
    const total = netRoom + gstRoom + mealBase + mealGst;
    const balance = Math.max(0, total - advN);
    return { roomTotal, discAmt, netRoom, gstRoom, mealBase, mealGst, total, balance, subs };
  }, [roomQtys, wknd, nights, discPct, mealOn, adultsN, advN]);

  const totalGuests =
    adultsN + (parseInt(k1) || 0) + (parseInt(k2) || 0) + (parseInt(k3) || 0);

  const validate = (): boolean => {
    const errs: Errors = {};
    if (!name.trim()) errs.name = true;
    if (!/^\d{10}$/.test(mobile.trim())) errs.mobile = true;
    if (!checkin) errs.checkin = true;
    if (!checkout || checkout <= checkin) errs.checkout = true;
    setErrors(errs);
    const roomsSelected = ROOMS.some((r) => (parseInt(roomQtys[r.id] || "0") || 0) > 0);
    if (!roomsSelected) {
      showNotif("Please select at least one room", "error");
      return false;
    }
    return Object.keys(errs).length === 0;
  };

  const onCreate = () => {
    if (!validate()) return;
    const id =
      "VR-" +
      new Date().getFullYear() +
      "-" +
      String(bookings.length + 1).padStart(3, "0");
    const rooms = ROOMS.filter((r) => (parseInt(roomQtys[r.id] || "0") || 0) > 0).map((r) => ({
      id: r.id,
      name: r.name,
      qty: parseInt(roomQtys[r.id] || "0"),
    }));
    const status: Booking["status"] = advN > 0 ? "Confirmed" : "Draft";
    const newB: Booking = {
      id,
      guest: name.trim(),
      mobile: mobile.trim(),
      email,
      source,
      checkin,
      checkout,
      nights,
      adults: adultsN,
      kids: (parseInt(k1) || 0) + (parseInt(k2) || 0) + (parseInt(k3) || 0),
      rooms,
      roomTotal: calc.roomTotal,
      discPct,
      discAmt: calc.discAmt,
      netRoom: calc.netRoom,
      gstRoom: calc.gstRoom,
      mealOn,
      mealTotal: calc.mealBase,
      mealGst: calc.mealGst,
      total: calc.total,
      advance: advN,
      balance: calc.balance,
      status,
      rex: currentUser,
      allocatedRoom: null,
      notes,
      payments:
        advN > 0
          ? [
              {
                date: todayStr(),
                time: nowTime(),
                type: "Advance",
                amount: advN,
                mode: paymode,
                by: currentUser,
              },
            ]
          : [],
      extras: [],
    };
    createBooking(newB);
    showNotif(`Booking ${id} created — ${status}`, "success");
    router.push(`/bookings/${id}`);
  };

  const onPreview = () => {
    const previewBooking: Booking = {
      id: "PREVIEW",
      guest: name || "Guest Name",
      mobile,
      email,
      source,
      checkin,
      checkout,
      nights,
      adults: adultsN,
      kids: (parseInt(k1) || 0) + (parseInt(k2) || 0) + (parseInt(k3) || 0),
      rooms: ROOMS.filter((r) => (parseInt(roomQtys[r.id] || "0") || 0) > 0).map((r) => ({
        id: r.id,
        name: r.name,
        qty: parseInt(roomQtys[r.id] || "0"),
      })),
      roomTotal: calc.roomTotal,
      discPct,
      discAmt: calc.discAmt,
      netRoom: calc.netRoom,
      gstRoom: calc.gstRoom,
      mealOn,
      mealTotal: calc.mealBase,
      mealGst: calc.mealGst,
      total: calc.total,
      advance: advN,
      balance: calc.balance,
      status: advN > 0 ? "Confirmed" : "Draft",
      rex: currentUser,
      allocatedRoom: null,
      notes,
      payments: [],
      extras: [],
    };
    openModal({ kind: "quote", quote: { kind: "preview", booking: previewBooking } });
  };

  const setQty = (id: string, val: string) =>
    setRoomQtys((prev) => ({ ...prev, [id]: val }));

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>New B2C Booking</h2>
          <p>Pricing auto-calculates as you fill the form</p>
        </div>
        <Link href="/bookings" className="btn btn-ghost btn-sm">← All Bookings</Link>
      </div>

      <div className="form-layout">
        <div>
          <div className="form-panel">
            <div className="form-sec">
              <div className="form-sec-title"><span className="form-sec-num">1</span>Guest Details</div>
              <div className="fg">
                <div className={`field${errors.name ? " error" : ""}`}>
                  <label>Guest Name *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                  <span className="field-err">Name is required</span>
                </div>
                <div className={`field${errors.mobile ? " error" : ""}`}>
                  <label>Mobile Number *</label>
                  <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit number" />
                  <span className="field-err">Valid mobile required</span>
                </div>
                <div className="field">
                  <label>Email (optional)</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="field">
                  <label>Enquiry Source</label>
                  <select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option>WhatsApp</option>
                    <option>Phone Call</option>
                    <option>Walk-in</option>
                    <option>Referral</option>
                    <option>OTA</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-sec">
              <div className="form-sec-title"><span className="form-sec-num">2</span>Guest Count</div>
              <div className="fg3">
                <div className="field"><label>Adults</label><input type="number" value={adults} onChange={(e) => setAdults(e.target.value)} min={1} /></div>
                <div className="field"><label>Kids &gt;10 yrs</label><input type="number" value={k1} onChange={(e) => setK1(e.target.value)} min={0} /></div>
                <div className="field"><label>Kids 6–10 yrs</label><input type="number" value={k2} onChange={(e) => setK2(e.target.value)} min={0} /></div>
                <div className="field"><label>Kids 2–6 yrs</label><input type="number" value={k3} onChange={(e) => setK3(e.target.value)} min={0} /></div>
                <div className="field"><label>Infant &lt;2 yrs</label><input type="number" value={infants} onChange={(e) => setInfants(e.target.value)} min={0} /></div>
              </div>
            </div>
          </div>

          <div className="form-panel">
            <div className="form-sec">
              <div className="form-sec-title"><span className="form-sec-num">3</span>Stay Dates</div>
              <div className="fg">
                <div className={`field${errors.checkin ? " error" : ""}`}>
                  <label>Check-in Date *</label>
                  <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} />
                  <span className="field-err">Select check-in date</span>
                </div>
                <div className={`field${errors.checkout ? " error" : ""}`}>
                  <label>Check-out Date *</label>
                  <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} />
                  <span className="field-err">Check-out must be after check-in</span>
                </div>
                <div className="field"><label>Nights</label><input type="number" value={nights} readOnly /></div>
                <div className="field"><label>Rate Type</label><input type="text" value={rateType} readOnly /></div>
              </div>
            </div>

            <div className="form-sec">
              <div className="form-sec-title">
                <span className="form-sec-num">4</span>Room Selection
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--t3)", marginLeft: 4 }}>
                  Select qty for each room type
                </span>
              </div>
              <div>
                {ROOMS.map((r) => (
                  <div key={r.id} className="room-row">
                    <div>
                      <div className="room-name">{r.name}</div>
                      <div className="room-rate">
                        WD ₹{r.wd.toLocaleString("en-IN")} · WE ₹{r.wknd.toLocaleString("en-IN")} · GST {r.gst}%
                      </div>
                    </div>
                    <input
                      type="number"
                      className="room-qty"
                      value={roomQtys[r.id]}
                      onChange={(e) => setQty(r.id, e.target.value)}
                      min={0}
                      max={20}
                    />
                    <div className="room-sub">{fmt(calc.subs[r.id] || 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="form-panel">
            <div className="form-sec">
              <div className="form-sec-title"><span className="form-sec-num">5</span>Packages</div>
              <div className="tgl-row">
                <div>
                  <div className="tgl-lbl">Meal &amp; Activity Package</div>
                  <div className="tgl-sub">₹2,100 per adult per night · Buffet, BBQ, all activities</div>
                </div>
                <label className="tgl">
                  <input type="checkbox" checked={mealOn} onChange={(e) => setMealOn(e.target.checked)} />
                  <span className="tgl-sl"></span>
                </label>
              </div>
            </div>

            <div className="form-sec" style={{ borderBottom: "none" }}>
              <div className="form-sec-title"><span className="form-sec-num">6</span>Discount</div>
              <div className="disc-wrap">
                <div className="disc-top">
                  <span className="disc-lbl">Discount Applied</span>
                  <span className="disc-val">{discPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={maxDisc}
                  step={1}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
                <div className="disc-limit">
                  Maximum for <strong>{currentRole}</strong>:{" "}
                  <strong>{maxDisc === 100 ? "Unlimited" : maxDisc + "%"}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="form-panel">
            <div className="form-sec">
              <div className="form-sec-title"><span className="form-sec-num">7</span>Payment</div>
              <div className="fg">
                <div className="field">
                  <label>Advance Received (₹)</label>
                  <input type="number" value={advance} onChange={(e) => setAdvance(e.target.value)} min={0} placeholder="0 = save as Draft" />
                </div>
                <div className="field">
                  <label>Payment Mode</label>
                  <select value={paymode} onChange={(e) => setPaymode(e.target.value)}>
                    <option>UPI / QR</option>
                    <option>Bank Transfer</option>
                    <option>Cash</option>
                  </select>
                </div>
              </div>
              <div className="hbox hbox-blu" style={{ marginTop: 12 }}>
                <div className="hbox-title">Draft vs Confirmed</div>
                <p className="hbox-p">
                  Advance = ₹0 saves as <strong>Draft</strong>. Any amount triggers <strong>Confirmed</strong> — adds to Room Chart and Revenue ledger.
                </p>
              </div>
            </div>

            <div className="form-sec" style={{ borderBottom: "none" }}>
              <div className="field">
                <label>Special Request / Notes</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Meal preference, occasion, special requirements..." />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: "center", padding: 12, fontSize: 14 }}
              onClick={onCreate}
            >
              ✓ Create Booking
            </button>
            <button className="btn btn-ghost" style={{ padding: "12px 16px" }} onClick={onPreview}>
              📄 Preview Quote
            </button>
          </div>
        </div>

        <div>
          <div className="price-panel">
            <h3>Live Price Summary</h3>
            <div className="pr"><span className="pr-lbl">Room charges</span><span className="pr-val">{fmt(calc.roomTotal)}</span></div>
            <div className="pr"><span className="pr-lbl">Discount</span><span className="pr-val" style={{ color: "#fb923c" }}>− {fmt(calc.discAmt)}</span></div>
            <div className="pr"><span className="pr-lbl">Net room charges</span><span className="pr-val">{fmt(calc.netRoom)}</span></div>
            <div className="pr-div"></div>
            <div className="pr"><span className="pr-lbl">Meal &amp; Activity Package</span><span className="pr-val">{fmt(calc.mealBase)}</span></div>
            <div className="pr"><span className="pr-lbl">GST on rooms</span><span className="pr-val">{fmt(calc.gstRoom)}</span></div>
            <div className="pr"><span className="pr-lbl">GST on meals (18%)</span><span className="pr-val">{fmt(calc.mealGst)}</span></div>
            <div className="pr-div"></div>
            <div className="pr-total">
              <span className="pr-total-lbl">Total Payable</span>
              <span className="pr-total-val">{fmt(calc.total)}</span>
            </div>
            <div className="pr-balance">
              <div className="pr-bal-row"><span className="pr-bal-lbl">Advance paid</span><span className="pr-bal-val">{fmt(advN)}</span></div>
              <div className="pr-bal-row"><span className="pr-bal-lbl">Balance at check-in</span><span className="pr-bal-val due">{fmt(calc.balance)}</span></div>
            </div>
            <div className="pr-meta">
              <div className="pr-meta-lbl">Booking Summary</div>
              <div className="pr"><span className="pr-lbl">Nights</span><span className="pr-val">{nights} night{nights !== 1 ? "s" : ""}</span></div>
              <div className="pr"><span className="pr-lbl">Total guests</span><span className="pr-val">{totalGuests} guest{totalGuests !== 1 ? "s" : ""}</span></div>
              <div className="pr"><span className="pr-lbl">Created by</span><span className="pr-val">{currentUser}</span></div>
              <div className="pr" style={{ marginBottom: 0 }}>
                <span className="pr-lbl">Status on save</span>
                <span className="pr-val" style={{ color: "var(--acc2)" }}>{advN > 0 ? "Confirmed" : "Draft"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
