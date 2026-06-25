"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import {
  calcPricingRow,
  fmt,
  maxDiscountForRowAndRole,
  nightsBetween,
  nowTime,
  splitNightsByType,
  todayStr,
  tryAssignRooms,
} from "@/lib/utils";
import type { Booking, BookingStatus, PricingRow, PricingRowType } from "@/types";

type FormRow = {
  uid: string;
  rowType: PricingRowType;
  roomId: string;
  tariff: string;
  nights: string;
  numRooms: string;
  discountPct: string;
};

type FieldErrors = {
  name?: boolean;
  mobile?: boolean;
  checkin?: boolean;
  checkout?: boolean;
  rooms?: boolean;
};

const ROW_LABEL: Record<PricingRowType, string> = {
  "sun-thu": "Sun–Thu",
  "fri":     "Friday",
  "sat":     "Sat & Peak",
  "fri-sat": "Fri–Sat",   // legacy
  custom:    "Custom",
};

const newUid = () => Math.random().toString(36).slice(2, 9);

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

function rowsFromBooking(b: Booking): FormRow[] {
  return b.pricingRows.map((r) => ({
    uid: newUid(),
    rowType: r.rowType,
    roomId: r.roomId,
    tariff: String(r.tariff),
    nights: String(r.nights),
    numRooms: String(r.numRooms),
    discountPct: String(r.discountPct),
  }));
}

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "5px 7px",
  border: "1px solid var(--bd)",
  borderRadius: "var(--r3)",
  fontSize: 12,
  textAlign: "right",
  outline: "none",
  background: "var(--surf)",
};

export type BookingFormProps = {
  mode: "create" | "edit";
  initial?: Booking;
};

export function BookingForm({ mode, initial }: BookingFormProps) {
  const router = useRouter();
  const {
    currentRole,
    currentUser,
    bookings,
    createBooking,
    updateBooking,
    showNotif,
    rooms,
    roomInventory,
    discountCaps,
    packageRates,
    gstSettings,
    bulkRoomBlocks,
  } = useApp();

  const isEdit = mode === "edit" && !!initial;

  // ─── Form state ───
  const [name, setName] = useState(initial?.guest ?? "");
  const [mobile, setMobile] = useState(initial?.mobile ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [source, setSource] = useState<"Direct" | "OTA">(
    initial?.source === "OTA" ? "OTA" : "Direct"
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [adults, setAdults] = useState(String(initial?.adults ?? 2));
  const [kidsAbove10, setKidsAbove10] = useState(String(initial?.kidsAbove10 ?? 0));
  const [kids6to10, setKids6to10] = useState(String(initial?.kids6to10 ?? 0));
  const [kids2to6, setKids2to6] = useState(String(initial?.kids2to6 ?? 0));
  const [infants, setInfants] = useState(String(initial?.infantsBelow2 ?? 0));
  const [seniors, setSeniors] = useState(String(initial?.seniors ?? 0));
  const [pets, setPets] = useState(String(initial?.pets ?? 0));
  const [drivers, setDrivers] = useState(String(initial?.driverCount ?? 0));
  const [driverMealOn, setDriverMealOn] = useState(initial?.driverMealOn ?? false);

  const [checkin, setCheckin] = useState(initial?.checkin ?? "");
  const [checkout, setCheckout] = useState(initial?.checkout ?? "");

  const [rows, setRows] = useState<FormRow[]>(
    initial ? rowsFromBooking(initial) : []
  );

  const [mealOn, setMealOn] = useState(initial?.mealOn ?? false);

  const initialAdvance = initial?.advance ?? 0;
  const [advance, setAdvance] = useState(String(initialAdvance));
  const [paymode, setPaymode] = useState(initial?.payments?.[0]?.mode ?? "Bank Transfer");

  const [errors, setErrors] = useState<FieldErrors>({});

  type AddOnRow = { uid: string; category: string; amount: string; gstPct: string };
  const [addOnRows, setAddOnRows] = useState<AddOnRow[]>([]);

  type PaymentRow = { uid: string; date: string; amount: string; mode: string };
  const todayDate = typeof window !== "undefined" ? new Date().toISOString().split("T")[0] : "";
  const [newPaymentRows, setNewPaymentRows] = useState<PaymentRow[]>([
    { uid: newUid(), date: todayDate, amount: "", mode: "Bank Transfer" },
  ]);

  // Seed default dates on create
  useEffect(() => {
    if (!isEdit && (!checkin || !checkout)) {
      const { ci, co } = getInitialDates();
      setCheckin(ci);
      setCheckout(co);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalNights = nightsBetween(checkin, checkout);
  const { weekday, friday, saturday } = useMemo(
    () => splitNightsByType(checkin, checkout),
    [checkin, checkout]
  );

  // Auto-row sync on date change. Preserve user's per-row picks; just resync nights.
  useEffect(() => {
    if (!checkin || !checkout || checkout <= checkin) return;
    setRows((prev) => {
      const customRows = prev.filter((r) => r.rowType === "custom");
      const sunThu = prev.find((r) => r.rowType === "sun-thu");
      const friRow = prev.find((r) => r.rowType === "fri");
      const satRow = prev.find((r) => r.rowType === "sat");
      const next: FormRow[] = [];
      if (weekday > 0) {
        next.push(
          sunThu
            ? { ...sunThu, nights: String(weekday) }
            : { uid: newUid(), rowType: "sun-thu", roomId: "", tariff: "0", nights: String(weekday), numRooms: "1", discountPct: "0" }
        );
      }
      if (friday > 0) {
        next.push(
          friRow
            ? { ...friRow, nights: String(friday) }
            : { uid: newUid(), rowType: "fri", roomId: "", tariff: "0", nights: String(friday), numRooms: "1", discountPct: "0" }
        );
      }
      if (saturday > 0) {
        next.push(
          satRow
            ? { ...satRow, nights: String(saturday) }
            : { uid: newUid(), rowType: "sat", roomId: "", tariff: "0", nights: String(saturday), numRooms: "1", discountPct: "0" }
        );
      }
      return [...next, ...customRows];
    });
  }, [checkin, checkout, weekday, friday, saturday]);

  const setRow = (uid: string, patch: Partial<FormRow>) =>
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));

  const removeRow = (uid: string) =>
    setRows((prev) => prev.filter((r) => r.uid !== uid));

  const addCustomRow = () =>
    setRows((prev) => [
      ...prev,
      {
        uid: newUid(),
        rowType: "custom",
        roomId: "",
        tariff: "0",
        nights: "1",
        numRooms: "1",
        discountPct: "0",
      },
    ]);

  const onRoomChange = (uid: string, roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    setRows((prev) =>
      prev.map((r) => {
        if (r.uid !== uid) return r;
        let tariff = r.tariff;
        let discountPct = r.discountPct;
        if (room) {
          tariff = String(room.price);
          const dayDisc =
            r.rowType === "sat" ? room.weekendDiscount
            : r.rowType === "fri" ? room.fridayDiscount
            : room.weekdayDiscount;
          discountPct = String(dayDisc);
        }
        return { ...r, roomId, tariff, discountPct };
      })
    );
  };

  const onDiscChange = (uid: string, val: string) => {
    const row = rows.find((r) => r.uid === uid);
    if (!row) return;
    const cap = maxDiscountForRowAndRole(row.rowType, currentRole, discountCaps);
    const v = parseFloat(val);
    if (!isNaN(v) && v > cap) setRow(uid, { discountPct: String(cap) });
    else setRow(uid, { discountPct: val });
  };

  // ─── Calculations ───
  const computedRows = useMemo<PricingRow[]>(
    () =>
      rows.map((r) =>
        calcPricingRow(
          r.rowType,
          r.roomId,
          parseFloat(r.tariff) || 0,
          parseInt(r.nights) || 0,
          parseInt(r.numRooms) || 0,
          Math.min(
            parseFloat(r.discountPct) || 0,
            maxDiscountForRowAndRole(r.rowType, currentRole, discountCaps)
          ),
          gstSettings,
          rooms
        )
      ),
    [rows, currentRole, gstSettings]
  );

  const totalRoomCharges = computedRows.reduce((s, r) => s + r.totalAmt, 0);

  const adultsN = parseInt(adults) || 0;
  const petsN = parseInt(pets) || 0;
  const driversN = parseInt(drivers) || 0;
  const createAdvance = newPaymentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const advN = isEdit ? initialAdvance : createAdvance;

  const mealCharges = mealOn ? packageRates.mealPerAdultPerNight * totalNights * adultsN : 0;
  const mealGstAmt = mealCharges * 0.18;
  const totalMealAmt = mealCharges + mealGstAmt;

  const petCharges = petsN > 0 ? packageRates.petPerPetPerNight * totalNights * petsN : 0;
  const petGstAmt = petCharges * 0.18;
  const totalPetAmt = petCharges + petGstAmt;

  const driverMealCharges = driverMealOn && driversN > 0 ? packageRates.mealPerAdultPerNight * totalNights * driversN : 0;
  const driverMealGstAmt = driverMealCharges * 0.18;
  const totalDriverMealAmt = driverMealCharges + driverMealGstAmt;

  const totalMealPet = totalMealAmt + totalPetAmt + totalDriverMealAmt;

  const addOnTotals = addOnRows.map(r => {
    const amt = parseFloat(r.amount) || 0;
    const gstPct = parseFloat(r.gstPct) || 0;
    const gstAmt = amt * gstPct / 100;
    return { amt, gstAmt, total: amt + gstAmt };
  });
  const totalAddOnBasic = addOnTotals.reduce((s, r) => s + r.amt, 0);
  const totalAddOnGst = addOnTotals.reduce((s, r) => s + r.gstAmt, 0);
  const totalAddOn = addOnTotals.reduce((s, r) => s + r.total, 0);

  const grandTotal = totalRoomCharges + totalMealPet + totalAddOn;
  const balance = Math.max(0, grandTotal - advN);

  // ─── Validation ───
  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!name.trim()) errs.name = true;
    if (!/^\d{10}$/.test(mobile.trim())) errs.mobile = true;
    if (!checkin) errs.checkin = true;
    if (!checkout || checkout <= checkin) errs.checkout = true;
    const hasRoom = rows.some((r) => r.roomId);
    if (!hasRoom) errs.rooms = true;
    setErrors(errs);
    if (errs.rooms) {
      showNotif("Please select room category in at least one row", "error");
      return false;
    }
    if (errs.name || errs.mobile || errs.checkin || errs.checkout) {
      showNotif("Fix the highlighted fields", "error");
      return false;
    }
    return true;
  };

  // ─── Build / patch ───
  const buildNewBooking = (
    id: string,
    status: BookingStatus,
    allocatedRooms: string[]
  ): Booking => {
    const pricingRows = computedRows.filter((r) => r.roomId);
    return {
      id,
      guest: name.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      source,
      notes: notes.trim(),
      rex: currentUser,

      checkin,
      checkout,
      nights: totalNights,

      adults: adultsN,
      kidsAbove10: parseInt(kidsAbove10) || 0,
      kids6to10: parseInt(kids6to10) || 0,
      kids2to6: parseInt(kids2to6) || 0,
      infantsBelow2: parseInt(infants) || 0,
      seniors: parseInt(seniors) || 0,
      pets: petsN,

      pricingRows,

      mealOn,
      mealTotal: mealCharges,
      mealGst: mealGstAmt,
      petTotal: petCharges,
      petGst: petGstAmt,
      driverCount: driversN,
      driverTotal: 0,
      driverGst: 0,
      driverMealOn,
      driverMealTotal: driverMealCharges,
      driverMealGst: driverMealGstAmt,

      totalRoomCharges,
      totalMealCharges: totalMealPet,
      grandTotal,

      advance: createAdvance,
      balance,

      status,
      allocatedRooms,

      payments: newPaymentRows
        .filter((p) => p.date && (parseFloat(p.amount) || 0) > 0)
        .map((p) => ({
          date: p.date,
          time: nowTime(),
          type: "Advance",
          amount: parseFloat(p.amount) || 0,
          mode: p.mode,
          by: currentUser,
        })),
      extras: [],
    };
  };

  const buildEditPatch = (allocatedRooms: string[]): Partial<Booking> => {
    const pricingRows = computedRows.filter((r) => r.roomId);
    const validNewPayments = newPaymentRows
      .filter((p) => p.date && (parseFloat(p.amount) || 0) > 0)
      .map((p) => ({
        date: p.date,
        time: new Date().toTimeString().slice(0, 5),
        type: "Payment",
        amount: parseFloat(p.amount) || 0,
        mode: p.mode,
        by: currentUser,
      }));
    const allPayments = validNewPayments.length > 0
      ? [...(initial?.payments ?? []), ...validNewPayments]
      : undefined;
    const newAdvance = validNewPayments.length > 0
      ? initialAdvance + validNewPayments.reduce((s, p) => s + p.amount, 0)
      : undefined;
    return {
      guest: name.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      source,
      notes: notes.trim(),

      checkin,
      checkout,
      nights: totalNights,

      adults: adultsN,
      kidsAbove10: parseInt(kidsAbove10) || 0,
      kids6to10: parseInt(kids6to10) || 0,
      kids2to6: parseInt(kids2to6) || 0,
      infantsBelow2: parseInt(infants) || 0,
      seniors: parseInt(seniors) || 0,
      pets: petsN,

      pricingRows,

      mealOn,
      mealTotal: mealCharges,
      mealGst: mealGstAmt,
      petTotal: petCharges,
      petGst: petGstAmt,
      driverCount: driversN,
      driverTotal: 0,
      driverGst: 0,
      driverMealOn,
      driverMealTotal: driverMealCharges,
      driverMealGst: driverMealGstAmt,

      totalRoomCharges,
      totalMealCharges: totalMealPet,
      grandTotal,

      ...(allPayments !== undefined && { payments: allPayments }),
      ...(newAdvance !== undefined && {
        advance: newAdvance,
        balance: Math.max(0, grandTotal - newAdvance),
      }),
      ...(newAdvance === undefined && {
        balance: Math.max(0, grandTotal - initialAdvance),
      }),
      allocatedRooms,
    };
  };

  // ─── Save handlers ───
  const saveCreate = (intent: "Enquiry" | "Tentative" | "Confirmed") => {
    if (!validate()) return;
    if (intent === "Confirmed" && (parseInt(advance) || 0) <= 0) {
      showNotif("Enter advance amount to confirm", "error");
      return;
    }
    const id =
      "VR-" +
      new Date().getFullYear() +
      "-" +
      String(bookings.length + 1).padStart(3, "0");
    let allocatedRooms: string[] = [];
    if (intent === "Tentative" || intent === "Confirmed") {
      const result = tryAssignRooms(
        computedRows.filter((r) => r.roomId),
        checkin,
        checkout,
        bookings,
        roomInventory,
        undefined,
        bulkRoomBlocks,
        rooms
      );
      if (!result.ok) {
        showNotif(`No ${result.missingCategoryName} available for selected dates`, "error");
        return;
      }
      allocatedRooms = result.rooms;
    }
    const booking = buildNewBooking(id, intent, allocatedRooms);
    createBooking(booking);
    showNotif(`Booking ${id} saved — ${intent}`, "success");
    if (typeof window !== "undefined") {
      window.open(`/bookings/${id}/confirmation`, "_blank");
    }
    router.push(`/bookings/${id}`);
  };

  const saveEdit = (alsoOpenConfirmation: boolean) => {
    if (!validate() || !initial) return;
    let allocatedRooms = initial.allocatedRooms;
    if (initial.status === "Tentative" || initial.status === "Confirmed") {
      const result = tryAssignRooms(
        computedRows.filter((r) => r.roomId),
        checkin,
        checkout,
        bookings,
        roomInventory,
        initial.id,
        bulkRoomBlocks,
        rooms
      );
      if (!result.ok) {
        showNotif(`No ${result.missingCategoryName} available for selected dates`, "error");
        return;
      }
      allocatedRooms = result.rooms;
    } else if (initial.status === "Enquiry") {
      allocatedRooms = [];
    }
    updateBooking(initial.id, buildEditPatch(allocatedRooms));
    showNotif(`Booking ${initial.id} updated`, "success");
    if (alsoOpenConfirmation && typeof window !== "undefined") {
      window.open(`/bookings/${initial.id}/confirmation`, "_blank");
    }
    router.push(`/bookings/${initial.id}`);
  };

  const onCancel = () => {
    if (initial) router.push(`/bookings/${initial.id}`);
    else router.push("/bookings");
  };

  const confirmDisabled = createAdvance <= 0;

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>{isEdit ? `Edit Booking — ${initial!.id}` : "New B2C Booking"}</h2>
          <p>
            {isEdit
              ? "All fields editable. Add payment rows below to record new payments."
              : "Pricing auto-calculates as you fill the form"}
          </p>
        </div>
        {isEdit ? (
          <Link href={`/bookings/${initial!.id}`} className="btn btn-ghost btn-sm">
            Back to Booking
          </Link>
        ) : (
          <Link href="/bookings" className="btn btn-ghost btn-sm">
            All Bookings
          </Link>
        )}
      </div>

      {/* §1 Guest Info */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">1</span>Guest Information
          </div>
          <div className="fg">
            <div className={`field${errors.name ? " error" : ""}`}>
              <label>Guest Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
              <span className="field-err">Name is required</span>
            </div>
            <div className={`field${errors.mobile ? " error" : ""}`}>
              <label>Mobile Number *</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="10-digit number"
              />
              <span className="field-err">Enter valid 10-digit mobile number</span>
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="field">
              <label>Booking Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value as "Direct" | "OTA")}>
                <option value="Direct">Direct</option>
                <option value="OTA">OTA</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginTop: 11 }}>
            <label>Special Request / Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Meal preference, occasion, special requirements..."
            />
          </div>
        </div>
      </div>

      {/* §2 Guest Count */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">2</span>Guest Count
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 11, alignItems: "start" }}>
            <div className="field">
              <label>Adults</label>
              <input
                type="number"
                value={adults}
                onChange={(e) => setAdults(e.target.value)}
                min={1}
              />
            </div>
            <div className="field">
              <label>Senior Citizens</label>
              <input
                type="number"
                value={seniors}
                onChange={(e) => setSeniors(e.target.value)}
                min={0}
              />
              <div className="field-hint">for room setup tracking only</div>
            </div>
            <div className="field">
              <label>Kids &gt; 10 yrs</label>
              <input
                type="number"
                value={kidsAbove10}
                onChange={(e) => setKidsAbove10(e.target.value)}
                min={0}
              />
            </div>
            <div className="field">
              <label>Kids 6–10 yrs</label>
              <input
                type="number"
                value={kids6to10}
                onChange={(e) => setKids6to10(e.target.value)}
                min={0}
              />
            </div>
            <div className="field">
              <label>Kids 2–6 yrs</label>
              <input
                type="number"
                value={kids2to6}
                onChange={(e) => setKids2to6(e.target.value)}
                min={0}
              />
            </div>
            <div className="field">
              <label>Infants &lt; 2</label>
              <input
                type="number"
                value={infants}
                onChange={(e) => setInfants(e.target.value)}
                min={0}
              />
            </div>
            <div className="field">
              <label>Pets</label>
              <input
                type="number"
                value={pets}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  setPets(String(Math.max(0, Math.min(2, v))));
                }}
                min={0}
                max={2}
              />
              <div className="field-hint">max 2 per villa</div>
            </div>
          </div>
        </div>
      </div>

      {/* §3 Stay Dates & Pricing */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">3</span>Stay Dates &amp; Pricing
          </div>
          <div className="fg3" style={{ marginBottom: 14 }}>
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
            <div className="field">
              <label>Total Nights</label>
              <input type="number" value={totalNights} readOnly />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 90 }}>Day Type</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 180 }}>Room Category</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 100, textAlign: "right" }}>Tariff</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 60, textAlign: "right" }}>Nights</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 60, textAlign: "right" }}>Rooms</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 110, textAlign: "right" }}>Charges</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 70, textAlign: "right" }}>Disc %</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 100, textAlign: "right" }}>Disc Amt</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 110, textAlign: "right" }}>Net</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 60, textAlign: "right" }}>GST %</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 100, textAlign: "right" }}>GST Amt</th>
                  <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 110, textAlign: "right" }}>Total</th>
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="empty-state" style={{ padding: 20 }}>
                        <p>Pick check-in and check-out dates above to auto-generate pricing rows.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => {
                    const calc = computedRows[i];
                    const cap = maxDiscountForRowAndRole(row.rowType, currentRole, discountCaps);
                    const overCap = (parseFloat(row.discountPct) || 0) > cap;
                    return (
                      <tr key={row.uid} style={{ cursor: "default" }}>
                        <td style={{ verticalAlign: "middle" }}>
                          <span
                            className="badge"
                            style={{
                              background:
                                row.rowType === "sat" || row.rowType === "fri-sat" ? "var(--acc-bg)"
                                : row.rowType === "fri" ? "var(--amb-bg)"
                                : "var(--bd)",
                              color:
                                row.rowType === "sat" || row.rowType === "fri-sat" ? "var(--acc)"
                                : row.rowType === "fri" ? "var(--amb)"
                                : "var(--t2)",
                            }}
                          >
                            {ROW_LABEL[row.rowType]}
                          </span>
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <select
                            value={row.roomId}
                            onChange={(e) => onRoomChange(row.uid, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "5px 8px",
                              border: "1px solid var(--bd)",
                              borderRadius: "var(--r3)",
                              fontSize: 12,
                              background: "var(--surf)",
                              outline: "none",
                            }}
                          >
                            <option value="">— Select —</option>
                            {rooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <input
                            type="number"
                            value={row.tariff}
                            onChange={(e) => setRow(row.uid, { tariff: e.target.value })}
                            style={cellInputStyle}
                          />
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <input
                            type="number"
                            value={row.nights}
                            readOnly={row.rowType !== "custom"}
                            onChange={(e) => setRow(row.uid, { nights: e.target.value })}
                            style={cellInputStyle}
                          />
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <input
                            type="number"
                            value={row.numRooms}
                            min={1}
                            onChange={(e) => setRow(row.uid, { numRooms: e.target.value })}
                            style={cellInputStyle}
                          />
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            verticalAlign: "middle",
                            fontWeight: 600,
                            color: "var(--t1)",
                          }}
                        >
                          {fmt(calc.roomCharges)}
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <input
                            type="number"
                            value={row.discountPct}
                            min={0}
                            max={cap}
                            onChange={(e) => onDiscChange(row.uid, e.target.value)}
                            style={cellInputStyle}
                          />
                          {overCap && (
                            <div style={{ fontSize: 9, color: "var(--red)", marginTop: 2 }}>
                              Max {cap}%
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle", color: "var(--amb)" }}>
                          {calc.discountAmt > 0 ? `− ${fmt(calc.discountAmt)}` : "—"}
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                          {fmt(calc.netCharges)}
                        </td>
                        <td
                          style={{ textAlign: "center", verticalAlign: "middle", color: "var(--t3)" }}
                        >
                          {calc.gstRate > 0 ? `${calc.gstRate}%` : "—"}
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                          {fmt(calc.gstAmt)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            verticalAlign: "middle",
                            fontWeight: 700,
                            color: "var(--t1)",
                          }}
                        >
                          {fmt(calc.totalAmt)}
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => removeRow(row.uid)}
                            title="Remove row"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                <tr style={{ background: "var(--surf2)" }}>
                  <td colSpan={11} style={{ textAlign: "right", fontWeight: 700, color: "var(--t1)" }}>
                    Total Room Charges (A)
                  </td>
                  <td
                    style={{ textAlign: "right", fontWeight: 800, color: "var(--sb)", fontSize: 14 }}
                  >
                    {fmt(totalRoomCharges)}
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={addCustomRow}
          >
            Add Row
          </button>
        </div>
      </div>

      {/* §4 Meal Charges */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">4</span>Meal Charges
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", minWidth: 220 }}>
                Include Meal Package?
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="radio" name="meal" checked={mealOn} onChange={() => setMealOn(true)} /> Yes
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="radio" name="meal" checked={!mealOn} onChange={() => setMealOn(false)} /> No
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", minWidth: 220 }}>
                Drivers / Attendants
              </span>
              <input
                type="number"
                value={drivers}
                onChange={(e) => {
                  const v = Math.max(0, parseInt(e.target.value) || 0);
                  setDrivers(String(v));
                  if (v === 0) setDriverMealOn(false);
                }}
                min={0}
                style={{ width: 64, padding: "5px 8px", border: "1px solid var(--bd)", borderRadius: "var(--r3)", fontSize: 13, textAlign: "center", background: "var(--surf)", outline: "none" }}
              />
              {driversN > 0 && (
                <>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", marginLeft: 16 }}>
                    Include Meal for Driver?
                  </span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="driverMeal" checked={driverMealOn} onChange={() => setDriverMealOn(true)} /> Yes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="radio" name="driverMeal" checked={!driverMealOn} onChange={() => setDriverMealOn(false)} /> No
                  </label>
                </>
              )}
            </div>
          </div>

          {mealOn || petsN > 0 || (driverMealOn && driversN > 0) ? (
            <table>
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Charge</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Tariff</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Nights</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Pax</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Charges</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST %</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST Amt</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {mealOn && (
                  <tr style={{ cursor: "default" }}>
                    <td>
                      <strong>Meal &amp; Activity Package</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt(packageRates.mealPerAdultPerNight)}</td>
                    <td style={{ textAlign: "right" }}>{totalNights}</td>
                    <td style={{ textAlign: "right" }}>{adultsN}</td>
                    <td style={{ textAlign: "right" }}>{fmt(mealCharges)}</td>
                    <td style={{ textAlign: "right" }}>18%</td>
                    <td style={{ textAlign: "right" }}>{fmt(mealGstAmt)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totalMealAmt)}</td>
                  </tr>
                )}
                {petsN > 0 && (
                  <tr style={{ cursor: "default" }}>
                    <td>
                      <strong>Pet Package</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt(packageRates.petPerPetPerNight)}</td>
                    <td style={{ textAlign: "right" }}>{totalNights}</td>
                    <td style={{ textAlign: "right" }}>{petsN}</td>
                    <td style={{ textAlign: "right" }}>{fmt(petCharges)}</td>
                    <td style={{ textAlign: "right" }}>18%</td>
                    <td style={{ textAlign: "right" }}>{fmt(petGstAmt)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totalPetAmt)}</td>
                  </tr>
                )}
                {driverMealOn && driversN > 0 && (
                  <tr style={{ cursor: "default" }}>
                    <td>
                      <strong>Driver / Attendant Meal</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt(packageRates.mealPerAdultPerNight)}</td>
                    <td style={{ textAlign: "right" }}>{totalNights}</td>
                    <td style={{ textAlign: "right" }}>{driversN}</td>
                    <td style={{ textAlign: "right" }}>{fmt(driverMealCharges)}</td>
                    <td style={{ textAlign: "right" }}>18%</td>
                    <td style={{ textAlign: "right" }}>{fmt(driverMealGstAmt)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totalDriverMealAmt)}</td>
                  </tr>
                )}
                <tr style={{ background: "var(--surf2)" }}>
                  <td colSpan={7} style={{ textAlign: "right", fontWeight: 700, color: "var(--t1)" }}>
                    Total Meal Charges (B)
                  </td>
                  <td
                    style={{ textAlign: "right", fontWeight: 800, color: "var(--sb)", fontSize: 14 }}
                  >
                    {fmt(totalMealPet)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize: 12, color: "var(--t3)" }}>
              No packages selected. Toggle Yes above to include meal package, or add pets / drivers in Guest Count.
            </div>
          )}
        </div>
      </div>

      {/* §5 Add On Charges */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">5</span>Add On Charges
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 12 }}
            onClick={() =>
              setAddOnRows(prev => [
                ...prev,
                { uid: newUid(), category: "Room Charges", amount: "0", gstPct: "0" },
              ])
            }
          >
            Add Row
          </button>

          {addOnRows.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--t3)" }}>
              No add on charges. Click Add Row to add charges.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: "nowrap" }}>Category</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Amount (₹)</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST %</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST Amt</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Total</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {addOnRows.map((row, i) => {
                    const t = addOnTotals[i];
                    return (
                      <tr key={row.uid} style={{ cursor: "default" }}>
                        <td style={{ verticalAlign: "middle" }}>
                          <select
                            value={row.category}
                            onChange={(e) =>
                              setAddOnRows(prev =>
                                prev.map(r => r.uid === row.uid ? { ...r, category: e.target.value } : r)
                              )
                            }
                            style={{
                              width: "100%",
                              padding: "5px 8px",
                              border: "1px solid var(--bd)",
                              borderRadius: "var(--r3)",
                              fontSize: 12,
                              background: "var(--surf)",
                              outline: "none",
                            }}
                          >
                            <option>Room Charges</option>
                            <option>Meal Charges</option>
                            <option>Venue Charges</option>
                          </select>
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <input
                            type="number"
                            value={row.amount}
                            min={0}
                            onChange={(e) =>
                              setAddOnRows(prev =>
                                prev.map(r => r.uid === row.uid ? { ...r, amount: e.target.value } : r)
                              )
                            }
                            style={cellInputStyle}
                          />
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <input
                            type="number"
                            value={row.gstPct}
                            min={0}
                            max={28}
                            onChange={(e) =>
                              setAddOnRows(prev =>
                                prev.map(r => r.uid === row.uid ? { ...r, gstPct: e.target.value } : r)
                              )
                            }
                            style={cellInputStyle}
                          />
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                          {fmt(t.gstAmt)}
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: 700 }}>
                          {fmt(t.total)}
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              setAddOnRows(prev => prev.filter(r => r.uid !== row.uid))
                            }
                            title="Remove row"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* §6 Amount Due */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">6</span>Amount Due
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: "nowrap" }}>Items</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Basic Amount</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST Amount</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ cursor: "default" }}>
                    <td>Room Charges (A)</td>
                    <td style={{ textAlign: "right" }}>
                      {fmt(computedRows.reduce((s, r) => s + r.netCharges, 0))}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmt(computedRows.reduce((s, r) => s + r.gstAmt, 0))}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totalRoomCharges)}</td>
                  </tr>
                  {totalMealPet > 0 && (
                    <tr style={{ cursor: "default" }}>
                      <td>Meal Charges (B)</td>
                      <td style={{ textAlign: "right" }}>
                        {fmt(mealCharges + petCharges + driverMealCharges)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {fmt(mealGstAmt + petGstAmt + driverMealGstAmt)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totalMealPet)}</td>
                    </tr>
                  )}
                  {totalAddOn > 0 && (
                    <tr style={{ cursor: "default" }}>
                      <td>Add On Charges (C)</td>
                      <td style={{ textAlign: "right" }}>{fmt(totalAddOnBasic)}</td>
                      <td style={{ textAlign: "right" }}>{fmt(totalAddOnGst)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totalAddOn)}</td>
                    </tr>
                  )}
                  <tr style={{ background: "var(--surf2)", borderTop: "2px solid var(--bd)" }}>
                    <td style={{ fontWeight: 700, color: "var(--t1)", fontSize: 14 }}>Amount Due</td>
                    <td style={{ textAlign: "right", color: "var(--t3)" }}>—</td>
                    <td style={{ textAlign: "right", color: "var(--t3)" }}>—</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--font-outfit), Outfit, sans-serif",
                        fontSize: 20,
                        fontWeight: 800,
                        color: "var(--sb)",
                      }}
                    >
                      {fmt(grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              {isEdit ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>
                    Record Payments
                  </div>
                  <table className="pricing-tbl" style={{ marginBottom: 8 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount (₹)</th>
                        <th>Mode</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newPaymentRows.map((row) => (
                        <tr key={row.uid}>
                          <td>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => setNewPaymentRows((prev) =>
                                prev.map((r) => r.uid === row.uid ? { ...r, date: e.target.value } : r)
                              )}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={row.amount}
                              onChange={(e) => setNewPaymentRows((prev) =>
                                prev.map((r) => r.uid === row.uid ? { ...r, amount: e.target.value } : r)
                              )}
                            />
                          </td>
                          <td>
                            <select
                              value={row.mode}
                              onChange={(e) => setNewPaymentRows((prev) =>
                                prev.map((r) => r.uid === row.uid ? { ...r, mode: e.target.value } : r)
                              )}
                            >
                              <option>Bank Transfer</option>
                              <option>Cash</option>
                              <option>Credit Card</option>
                              <option>Credit Note</option>
                            </select>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {newPaymentRows.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{ color: "var(--red)" }}
                                onClick={() => setNewPaymentRows((prev) => prev.filter((r) => r.uid !== row.uid))}
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setNewPaymentRows((prev) => [
                      ...prev,
                      { uid: newUid(), date: todayDate, amount: "", mode: "Bank Transfer" },
                    ])}
                  >
                    + Add Row
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>
                    Record Payments
                  </div>
                  <table className="pricing-tbl" style={{ marginBottom: 8 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Amount (₹)</th>
                        <th>Mode</th>
                        <th style={{ width: 32 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newPaymentRows.map((row) => (
                        <tr key={row.uid}>
                          <td>
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) => setNewPaymentRows((prev) =>
                                prev.map((r) => r.uid === row.uid ? { ...r, date: e.target.value } : r)
                              )}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={row.amount}
                              onChange={(e) => setNewPaymentRows((prev) =>
                                prev.map((r) => r.uid === row.uid ? { ...r, amount: e.target.value } : r)
                              )}
                            />
                          </td>
                          <td>
                            <select
                              value={row.mode}
                              onChange={(e) => setNewPaymentRows((prev) =>
                                prev.map((r) => r.uid === row.uid ? { ...r, mode: e.target.value } : r)
                              )}
                            >
                              <option>Bank Transfer</option>
                              <option>Cash</option>
                              <option>Credit Card</option>
                              <option>Credit Note</option>
                            </select>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {newPaymentRows.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                style={{ color: "var(--red)" }}
                                onClick={() => setNewPaymentRows((prev) => prev.filter((r) => r.uid !== row.uid))}
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setNewPaymentRows((prev) => [
                      ...prev,
                      { uid: newUid(), date: todayDate, amount: "", mode: "Bank Transfer" },
                    ])}
                  >
                    + Add Row
                  </button>
                </div>
              )}
              <div
                className="detail-row"
                style={{
                  marginTop: 14,
                  background: balance > 0 ? "var(--amb-lt)" : "var(--grn-lt)",
                  padding: "10px 12px",
                  borderRadius: "var(--r2)",
                }}
              >
                <span className="detail-key" style={{ fontWeight: 600 }}>
                  Balance Amount
                </span>
                <span
                  className="detail-val"
                  style={{
                    fontWeight: 800,
                    color: balance > 0 ? "var(--amb)" : "var(--grn)",
                    fontSize: 16,
                  }}
                >
                  {balance > 0 ? fmt(balance) : "Paid"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons — mode-aware */}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        {isEdit ? (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "12px 18px" }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "12px 18px" }}
              onClick={() => saveEdit(false)}
            >
              Save Changes
            </button>
            <button
              type="button"
              className="btn btn-accent"
              style={{ padding: "12px 18px" }}
              onClick={() => saveEdit(true)}
            >
              Save &amp; View Pricing Sheet
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "12px 18px" }}
              onClick={() => saveCreate("Enquiry")}
            >
              Save as Enquiry
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "12px 18px" }}
              onClick={() => saveCreate("Tentative")}
            >
              Book Tentatively
            </button>
            <button
              type="button"
              className="btn btn-accent"
              style={{
                padding: "12px 18px",
                opacity: confirmDisabled ? 0.5 : 1,
                cursor: confirmDisabled ? "not-allowed" : "pointer",
              }}
              onClick={() => saveCreate("Confirmed")}
              disabled={confirmDisabled}
              title={confirmDisabled ? "Enter advance amount to confirm" : ""}
            >
              Confirm Booking
            </button>
          </>
        )}
      </div>
    </div>
  );
}
