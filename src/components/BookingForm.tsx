"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import {
  calcPricingRow,
  fiscalYearCode,
  fmt,
  maxDiscountForRowAndRole,
  nightsBetween,
  nowTime,
  splitNightsByType,
  todayStr,
  tryAssignRooms,
} from "@/lib/utils";
import type { Booking, BookingSegment, BookingStatus, PackageRates, PricingRow, PricingRowType, SegmentRoom } from "@/types";

type FormRow = {
  uid: string;
  rowType: PricingRowType;
  roomId: string;
  tariff: string;
  nights: string;
  numRooms: string;
  discountPct: string;
};

type FormSeg = {
  id: string;
  checkin: string;
  checkout: string;
  rows: FormRow[];
  adults: string;
  seniors: string;
  kidsAbove10: string;
  kids6to10: string;
  infants: string;
  pets: string;
  mealOn: boolean;
  mealRate: string;
  petRate: string;
  driverMealRate: string;
  drivers: string;
  driverMealOn: boolean;
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

function segsFromBooking(b: Booking, rates: PackageRates): FormSeg[] {
  return b.segments.map((seg) => ({
    id: seg.id,
    checkin: seg.checkin,
    checkout: seg.checkout,
    rows: seg.rooms.flatMap((room) =>
      room.pricingRows.map((pr) => ({
        uid: newUid(),
        rowType: pr.rowType,
        roomId: pr.roomId,
        tariff: String(pr.tariff),
        nights: String(pr.nights),
        numRooms: String(pr.numRooms),
        discountPct: String(pr.discountPct),
      }))
    ),
    adults: String(seg.adults ?? b.adults ?? 2),
    seniors: String(seg.seniors ?? b.seniors ?? 0),
    kidsAbove10: String(seg.kidsAbove10 ?? b.kidsAbove10 ?? 0),
    kids6to10: String(seg.kids6to10 ?? b.kids6to10 ?? 0),
    // Legacy 2–6 bucket folds into the Infants (0–6) bucket
    infants: String((seg.infantsBelow2 ?? b.infantsBelow2 ?? 0) + (seg.kids2to6 ?? b.kids2to6 ?? 0)),
    pets: String(seg.pets ?? b.pets ?? 0),
    mealOn: seg.mealOn ?? b.mealOn ?? false,
    mealRate: String(seg.mealRate ?? rates.mealPerAdultPerNight),
    petRate: String(seg.petRate ?? rates.petPerPetPerNight),
    driverMealRate: String(seg.driverMealRate ?? rates.mealPerAdultPerNight),
    drivers: String(seg.drivers ?? b.driverCount ?? 0),
    driverMealOn: seg.driverMealOn ?? b.driverMealOn ?? false,
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
    creditNotes,
    redeemCreditNote,
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

  const defaultSegGuests = {
    adults: "2", seniors: "0", kidsAbove10: "0", kids6to10: "0",
    infants: "0", pets: "0", mealOn: false, drivers: "0", driverMealOn: false,
    mealRate: String(packageRates.mealPerAdultPerNight),
    petRate: String(packageRates.petPerPetPerNight),
    driverMealRate: String(packageRates.mealPerAdultPerNight),
  };

  const [formSegs, setFormSegs] = useState<FormSeg[]>(() => {
    if (initial) return segsFromBooking(initial, packageRates);
    const { ci, co } = getInitialDates();
    const { weekday, friday, saturday } = splitNightsByType(ci, co);
    const initRows: FormRow[] = [];
    if (weekday > 0) initRows.push({ uid: newUid(), rowType: "sun-thu", roomId: "", tariff: "0", nights: String(weekday), numRooms: "1", discountPct: "0" });
    if (friday > 0) initRows.push({ uid: newUid(), rowType: "fri", roomId: "", tariff: "0", nights: String(friday), numRooms: "1", discountPct: "0" });
    if (saturday > 0) initRows.push({ uid: newUid(), rowType: "sat", roomId: "", tariff: "0", nights: String(saturday), numRooms: "1", discountPct: "0" });
    return [{ id: newUid(), checkin: ci, checkout: co, rows: initRows, ...defaultSegGuests }];
  });

  const initialAdvance = initial?.advance ?? 0;

  const [errors, setErrors] = useState<FieldErrors>({});

  type AddOnRow = { uid: string; category: string; amount: string; gstPct: string };
  const [addOnRows, setAddOnRows] = useState<AddOnRow[]>([]);

  type PaymentRow = { uid: string; date: string; amount: string; mode: string; cnCode: string };
  const todayDate = typeof window !== "undefined" ? new Date().toISOString().split("T")[0] : "";
  const [newPaymentRows, setNewPaymentRows] = useState<PaymentRow[]>([
    { uid: newUid(), date: todayDate, amount: "", mode: "Bank Transfer", cnCode: "" },
  ]);

  const checkin = formSegs.length > 0
    ? [...formSegs.map((s) => s.checkin).filter(Boolean)].sort()[0] ?? ""
    : "";
  const checkout = formSegs.length > 0
    ? [...formSegs.map((s) => s.checkout).filter(Boolean)].sort().at(-1) ?? ""
    : "";
  const totalNights = formSegs.reduce((s, seg) => s + nightsBetween(seg.checkin, seg.checkout), 0);

  const addSegment = () => {
    const { ci, co } = getInitialDates();
    const { weekday, friday, saturday } = splitNightsByType(ci, co);
    const initRows: FormRow[] = [];
    if (weekday > 0) initRows.push({ uid: newUid(), rowType: "sun-thu", roomId: "", tariff: "0", nights: String(weekday), numRooms: "1", discountPct: "0" });
    if (friday > 0) initRows.push({ uid: newUid(), rowType: "fri", roomId: "", tariff: "0", nights: String(friday), numRooms: "1", discountPct: "0" });
    if (saturday > 0) initRows.push({ uid: newUid(), rowType: "sat", roomId: "", tariff: "0", nights: String(saturday), numRooms: "1", discountPct: "0" });
    setFormSegs((prev) => [...prev, { id: newUid(), checkin: ci, checkout: co, rows: initRows, ...defaultSegGuests }]);
  };

  const removeSegment = (segId: string) => {
    setFormSegs((prev) => prev.filter((s) => s.id !== segId));
  };

  const updateSegDates = (segId: string, newCheckin: string, newCheckout: string) => {
    setFormSegs((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        if (!newCheckin || !newCheckout || newCheckout <= newCheckin) {
          return { ...s, checkin: newCheckin, checkout: newCheckout };
        }
        const { weekday: wd, friday: fr, saturday: sa } = splitNightsByType(newCheckin, newCheckout);
        const roomIds = [...new Set(s.rows.filter((r) => r.roomId).map((r) => r.roomId))];
        const customRows = s.rows.filter((r) => r.rowType === "custom");
        const newRows: FormRow[] = [];
        if (roomIds.length === 0) {
          if (wd > 0) newRows.push({ uid: newUid(), rowType: "sun-thu", roomId: "", tariff: "0", nights: String(wd), numRooms: "1", discountPct: "0" });
          if (fr > 0) newRows.push({ uid: newUid(), rowType: "fri", roomId: "", tariff: "0", nights: String(fr), numRooms: "1", discountPct: "0" });
          if (sa > 0) newRows.push({ uid: newUid(), rowType: "sat", roomId: "", tariff: "0", nights: String(sa), numRooms: "1", discountPct: "0" });
        } else {
          roomIds.forEach((roomId) => {
            const existing = s.rows.filter((r) => r.roomId === roomId);
            const sunThu = existing.find((r) => r.rowType === "sun-thu");
            const friRow = existing.find((r) => r.rowType === "fri");
            const satRow = existing.find((r) => r.rowType === "sat");
            const first = existing[0];
            if (wd > 0) newRows.push(sunThu ? { ...sunThu, nights: String(wd) } : { uid: newUid(), rowType: "sun-thu", roomId, tariff: first?.tariff ?? "0", nights: String(wd), numRooms: first?.numRooms ?? "1", discountPct: first?.discountPct ?? "0" });
            if (fr > 0) newRows.push(friRow ? { ...friRow, nights: String(fr) } : { uid: newUid(), rowType: "fri", roomId, tariff: first?.tariff ?? "0", nights: String(fr), numRooms: first?.numRooms ?? "1", discountPct: first?.discountPct ?? "0" });
            if (sa > 0) newRows.push(satRow ? { ...satRow, nights: String(sa) } : { uid: newUid(), rowType: "sat", roomId, tariff: first?.tariff ?? "0", nights: String(sa), numRooms: first?.numRooms ?? "1", discountPct: first?.discountPct ?? "0" });
          });
        }
        return { ...s, checkin: newCheckin, checkout: newCheckout, rows: [...newRows, ...customRows] };
      })
    );
  };

  const setSegRow = (segId: string, uid: string, patch: Partial<FormRow>) =>
    setFormSegs((prev) =>
      prev.map((s) =>
        s.id === segId ? { ...s, rows: s.rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)) } : s
      )
    );

  const removeSegRow = (segId: string, uid: string) =>
    setFormSegs((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, rows: s.rows.filter((r) => r.uid !== uid) } : s))
    );

  const addSegRoom = (segId: string) => {
    const seg = formSegs.find((s) => s.id === segId);
    if (!seg) return;
    const { weekday: wd, friday: fr, saturday: sa } = splitNightsByType(seg.checkin, seg.checkout);
    const newRows: FormRow[] = [];
    if (wd > 0) newRows.push({ uid: newUid(), rowType: "sun-thu", roomId: "", tariff: "0", nights: String(wd), numRooms: "1", discountPct: "0" });
    if (fr > 0) newRows.push({ uid: newUid(), rowType: "fri", roomId: "", tariff: "0", nights: String(fr), numRooms: "1", discountPct: "0" });
    if (sa > 0) newRows.push({ uid: newUid(), rowType: "sat", roomId: "", tariff: "0", nights: String(sa), numRooms: "1", discountPct: "0" });
    if (newRows.length === 0) newRows.push({ uid: newUid(), rowType: "custom", roomId: "", tariff: "0", nights: "1", numRooms: "1", discountPct: "0" });
    setFormSegs((prev) =>
      prev.map((s) => (s.id === segId ? { ...s, rows: [...s.rows, ...newRows] } : s))
    );
  };

  const onSegRoomChange = (segId: string, uid: string, roomId: string) => {
    const seg = formSegs.find((s) => s.id === segId);
    const row = seg?.rows.find((r) => r.uid === uid);
    if (!row) return;
    const room = rooms.find((r) => r.id === roomId);
    const wasEmpty = !row.roomId;
    const discFor = (rt: string) => {
      if (!room) return 0;
      return rt === "sat" ? room.weekendDiscount : rt === "fri" ? room.fridayDiscount : room.weekdayDiscount;
    };
    setFormSegs((prev) =>
      prev.map((s) => {
        if (s.id !== segId) return s;
        return {
          ...s,
          rows: s.rows.map((r) => {
            if (r.uid === uid) {
              return { ...r, roomId, tariff: room ? String(room.price) : r.tariff, discountPct: String(discFor(r.rowType)) };
            }
            // propagate to other empty rows when this row was also empty (same "add room" batch)
            if (wasEmpty && !r.roomId && room) {
              return { ...r, roomId, tariff: String(room.price), discountPct: String(discFor(r.rowType)) };
            }
            return r;
          }),
        };
      })
    );
  };

  const onSegDiscChange = (segId: string, uid: string, val: string) => {
    const seg = formSegs.find((s) => s.id === segId);
    const row = seg?.rows.find((r) => r.uid === uid);
    if (!row) return;
    const cap = maxDiscountForRowAndRole(row.rowType, currentRole, discountCaps);
    const v = parseFloat(val);
    setSegRow(segId, uid, { discountPct: !isNaN(v) && v > cap ? String(cap) : val });
  };

  const updateSegField = (segId: string, field: keyof FormSeg, value: string | boolean) => {
    setFormSegs((prev) => prev.map((s) => s.id === segId ? { ...s, [field]: value } : s));
  };

  // ─── Calculations ───
  const computedRows = useMemo<PricingRow[]>(
    () =>
      formSegs.flatMap((seg) =>
        seg.rows.map((r) =>
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
        )
      ),
    [formSegs, currentRole, gstSettings, rooms, discountCaps]
  );

  const computedSegments = useMemo(
    () =>
      formSegs.map((seg) => {
        let rowIdx = 0;
        for (const prevSeg of formSegs) {
          if (prevSeg.id === seg.id) break;
          rowIdx += prevSeg.rows.length;
        }
        const segCalcRows = computedRows.slice(rowIdx, rowIdx + seg.rows.length);
        const roomMap = new Map<string, { roomId: string; roomName: string; numRooms: number; discountPct: number; pricingRows: PricingRow[] }>();
        seg.rows.forEach((r, i) => {
          if (!r.roomId) return;
          const calc = segCalcRows[i];
          if (!calc) return;
          const stampedCalc = { ...calc, checkin: seg.checkin, checkout: seg.checkout };
          const existing = roomMap.get(r.roomId);
          if (existing) {
            existing.pricingRows.push(stampedCalc);
          } else {
            const roomObj = rooms.find((rm) => rm.id === r.roomId);
            roomMap.set(r.roomId, {
              roomId: r.roomId,
              roomName: roomObj?.name ?? "",
              numRooms: parseInt(r.numRooms) || 1,
              discountPct: parseFloat(r.discountPct) || 0,
              pricingRows: [stampedCalc],
            });
          }
        });
        const segRooms: SegmentRoom[] = Array.from(roomMap.values()).map((data) => ({
          id: data.roomId,
          ...data,
          netCharges: data.pricingRows.reduce((s, r) => s + r.netCharges, 0),
          gstAmt: data.pricingRows.reduce((s, r) => s + r.gstAmt, 0),
          totalAmt: data.pricingRows.reduce((s, r) => s + r.totalAmt, 0),
        }));
        return {
          id: seg.id,
          checkin: seg.checkin,
          checkout: seg.checkout,
          rooms: segRooms,
          segmentTotal: segRooms.reduce((s, r) => s + r.totalAmt, 0),
          adults: parseInt(seg.adults) || 2,
          seniors: parseInt(seg.seniors) || 0,
          kidsAbove10: parseInt(seg.kidsAbove10) || 0,
          kids6to10: parseInt(seg.kids6to10) || 0,
          kids2to6: 0,
          infantsBelow2: parseInt(seg.infants) || 0,
          pets: parseInt(seg.pets) || 0,
          mealOn: seg.mealOn,
          mealRate: parseFloat(seg.mealRate) || 0,
          petRate: parseFloat(seg.petRate) || 0,
          driverMealRate: parseFloat(seg.driverMealRate) || 0,
          drivers: parseInt(seg.drivers) || 0,
          driverMealOn: seg.driverMealOn,
          mealTotal: 0,
          mealGst: 0,
          mealWithGst: 0,
        } satisfies BookingSegment;
      }),
    [formSegs, computedRows, rooms]
  );

  const totalRoomCharges = computedRows.reduce((s, r) => s + r.totalAmt, 0);

  // Per-segment meal computations (used in UI and in buildNewBooking)
  const segMealCalcs = formSegs.map((seg) => {
    const nights = nightsBetween(seg.checkin, seg.checkout);
    const adultsN = parseInt(seg.adults) || 0;
    const petsN = parseInt(seg.pets) || 0;
    const driversN = parseInt(seg.drivers) || 0;
    const mealRate = parseFloat(seg.mealRate) || 0;
    const petRate = parseFloat(seg.petRate) || 0;
    const driverMealRate = parseFloat(seg.driverMealRate) || 0;
    const meal = seg.mealOn ? mealRate * nights * adultsN : 0;
    const pet = petsN > 0 ? petRate * nights * petsN : 0;
    const drvMeal = seg.driverMealOn && driversN > 0 ? driverMealRate * nights * driversN : 0;
    const base = meal + pet + drvMeal;
    const gst = base * 0.18;
    return { meal, pet, drvMeal, base, gst, total: base + gst, adultsN, petsN, driversN, nights };
  });
  const totalMealPet = segMealCalcs.reduce((s, c) => s + c.total, 0);

  const createAdvance = newPaymentRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  // Cumulative payments: previously recorded (edit mode) plus rows entered in this form
  const totalReceived = (isEdit ? initialAdvance : 0) + createAdvance;

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
  const balance = Math.max(0, grandTotal - totalReceived);

  // ─── Validation ───
  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!name.trim()) errs.name = true;
    if (!/^\d{10}$/.test(mobile.trim())) errs.mobile = true;
    if (!checkin) errs.checkin = true;
    if (!checkout || checkout <= checkin) errs.checkout = true;
    const hasRoom = formSegs.some((s) => s.rows.some((r) => r.roomId));
    if (!hasRoom) errs.rooms = true;
    setErrors(errs);
    if (errs.rooms) {
      showNotif("Please select room category in at least one segment", "error");
      return false;
    }
    if (errs.name || errs.mobile || errs.checkin || errs.checkout) {
      showNotif("Fix the highlighted fields", "error");
      return false;
    }
    return true;
  };

  // Credit-note payment rows must reference a valid note with enough balance
  // (summed across rows using the same code).
  const validateCreditNoteRows = (): boolean => {
    const usage = new Map<string, number>();
    for (const r of newPaymentRows) {
      if (r.mode !== "Credit Note") continue;
      const amt = parseFloat(r.amount) || 0;
      if (!r.date || amt <= 0) continue;
      const code = r.cnCode.trim();
      if (!code) {
        showNotif("Enter the credit note code for the credit note payment", "error");
        return false;
      }
      const cn = creditNotes.find((c) => c.code.toLowerCase() === code.toLowerCase());
      if (!cn) {
        showNotif(`Credit note ${code} not found`, "error");
        return false;
      }
      usage.set(cn.code, (usage.get(cn.code) ?? 0) + amt);
    }
    for (const [code, amt] of usage.entries()) {
      const cn = creditNotes.find((c) => c.code === code)!;
      if (amt > cn.remainingAmount) {
        showNotif(
          `${code} has only ₹${cn.remainingAmount.toLocaleString("en-IN")} remaining (entered ₹${amt.toLocaleString("en-IN")})`,
          "error"
        );
        return false;
      }
    }
    return true;
  };

  const redeemCreditNoteRows = (bookingId: string) => {
    newPaymentRows
      .filter((r) => r.mode === "Credit Note" && r.date && (parseFloat(r.amount) || 0) > 0)
      .forEach((r) => {
        const result = redeemCreditNote(r.cnCode, bookingId, parseFloat(r.amount) || 0);
        if (!result.ok) showNotif(result.error, "error");
      });
  };

  // ─── Build / patch ───
  const buildNewBooking = (
    id: string,
    status: BookingStatus,
    allocatedRooms: string[],
    segAlloc: Record<string, string[]> = {}
  ): Booking => {
    const validSegments = computedSegments
      .map((cs, i) => {
        const fs = formSegs[i];
        const mc = segMealCalcs[i];
        return {
          ...cs,
          allocatedRooms: segAlloc[cs.id] ?? [],
          adults: mc?.adultsN ?? 2,
          seniors: parseInt(fs?.seniors ?? "0") || 0,
          kidsAbove10: parseInt(fs?.kidsAbove10 ?? "0") || 0,
          kids6to10: parseInt(fs?.kids6to10 ?? "0") || 0,
          kids2to6: 0,
          infantsBelow2: parseInt(fs?.infants ?? "0") || 0,
          pets: mc?.petsN ?? 0,
          mealOn: fs?.mealOn ?? false,
          drivers: mc?.driversN ?? 0,
          driverMealOn: fs?.driverMealOn ?? false,
          mealTotal: mc?.base ?? 0,
          mealGst: mc?.gst ?? 0,
          mealWithGst: mc?.total ?? 0,
          segmentTotal: cs.segmentTotal + (mc?.total ?? 0),
        };
      })
      .filter((s) => s.rooms.length > 0);
    const maxAdults = Math.max(...validSegments.map((s) => s.adults), 0);
    const anyMeal = validSegments.some((s) => s.mealOn);
    const totalMealBase = segMealCalcs.reduce((s, c) => s + c.base, 0);
    const totalMealGst = segMealCalcs.reduce((s, c) => s + c.gst, 0);
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

      adults: maxAdults || 2,
      kidsAbove10: Math.max(...validSegments.map((s) => s.kidsAbove10), 0),
      kids6to10: Math.max(...validSegments.map((s) => s.kids6to10), 0),
      kids2to6: Math.max(...validSegments.map((s) => s.kids2to6), 0),
      infantsBelow2: Math.max(...validSegments.map((s) => s.infantsBelow2), 0),
      seniors: Math.max(...validSegments.map((s) => s.seniors), 0),
      pets: Math.max(...validSegments.map((s) => s.pets), 0),

      segments: validSegments,

      mealOn: anyMeal,
      mealTotal: totalMealBase,
      mealGst: totalMealGst,
      petTotal: segMealCalcs.reduce((s, c) => s + c.pet, 0),
      petGst: segMealCalcs.reduce((s, c) => s + c.pet, 0) * 0.18,
      driverCount: Math.max(...validSegments.map((s) => s.drivers), 0),
      driverTotal: 0,
      driverGst: 0,
      driverMealOn: validSegments.some((s) => s.driverMealOn),
      driverMealTotal: segMealCalcs.reduce((s, c) => s + c.drvMeal, 0),
      driverMealGst: segMealCalcs.reduce((s, c) => s + c.drvMeal, 0) * 0.18,

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
          ...(p.mode === "Credit Note" && p.cnCode.trim() ? { creditNoteCode: p.cnCode.trim() } : {}),
        })),
      extras: [],
    };
  };

  const buildEditPatch = (
    allocatedRooms: string[],
    segAlloc: Record<string, string[]> = {}
  ): Partial<Booking> => {
    const validSegments = computedSegments.filter((s) => s.rooms.length > 0);
    const validNewPayments = newPaymentRows
      .filter((p) => p.date && (parseFloat(p.amount) || 0) > 0)
      .map((p) => ({
        date: p.date,
        time: new Date().toTimeString().slice(0, 5),
        type: "Payment",
        amount: parseFloat(p.amount) || 0,
        mode: p.mode,
        by: currentUser,
        ...(p.mode === "Credit Note" && p.cnCode.trim() ? { creditNoteCode: p.cnCode.trim() } : {}),
      }));
    const allPayments = validNewPayments.length > 0
      ? [...(initial?.payments ?? []), ...validNewPayments]
      : undefined;
    const newAdvance = validNewPayments.length > 0
      ? initialAdvance + validNewPayments.reduce((s, p) => s + p.amount, 0)
      : undefined;
    const segsFull = computedSegments
      .map((cs, i) => {
        const fs = formSegs[i];
        const mc = segMealCalcs[i];
        return {
          ...cs,
          allocatedRooms: segAlloc[cs.id] ?? [],
          adults: mc?.adultsN ?? 2,
          seniors: parseInt(fs?.seniors ?? "0") || 0,
          kidsAbove10: parseInt(fs?.kidsAbove10 ?? "0") || 0,
          kids6to10: parseInt(fs?.kids6to10 ?? "0") || 0,
          kids2to6: 0,
          infantsBelow2: parseInt(fs?.infants ?? "0") || 0,
          pets: mc?.petsN ?? 0,
          mealOn: fs?.mealOn ?? false,
          drivers: mc?.driversN ?? 0,
          driverMealOn: fs?.driverMealOn ?? false,
          mealTotal: mc?.base ?? 0,
          mealGst: mc?.gst ?? 0,
          mealWithGst: mc?.total ?? 0,
          segmentTotal: cs.segmentTotal + (mc?.total ?? 0),
        };
      })
      .filter((s) => s.rooms.length > 0);
    const anyMeal = segsFull.some((s) => s.mealOn);
    const totalMealBase = segMealCalcs.reduce((s, c) => s + c.base, 0);
    const totalMealGst = segMealCalcs.reduce((s, c) => s + c.gst, 0);
    return {
      guest: name.trim(),
      mobile: mobile.trim(),
      email: email.trim(),
      source,
      notes: notes.trim(),

      checkin,
      checkout,
      nights: totalNights,

      adults: Math.max(...segsFull.map((s) => s.adults), 0) || 2,
      kidsAbove10: Math.max(...segsFull.map((s) => s.kidsAbove10), 0),
      kids6to10: Math.max(...segsFull.map((s) => s.kids6to10), 0),
      kids2to6: Math.max(...segsFull.map((s) => s.kids2to6), 0),
      infantsBelow2: Math.max(...segsFull.map((s) => s.infantsBelow2), 0),
      seniors: Math.max(...segsFull.map((s) => s.seniors), 0),
      pets: Math.max(...segsFull.map((s) => s.pets), 0),

      segments: segsFull,

      mealOn: anyMeal,
      mealTotal: totalMealBase,
      mealGst: totalMealGst,
      petTotal: segMealCalcs.reduce((s, c) => s + c.pet, 0),
      petGst: segMealCalcs.reduce((s, c) => s + c.pet, 0) * 0.18,
      driverCount: Math.max(...segsFull.map((s) => s.drivers), 0),
      driverTotal: 0,
      driverGst: 0,
      driverMealOn: segsFull.some((s) => s.driverMealOn),
      driverMealTotal: segMealCalcs.reduce((s, c) => s + c.drvMeal, 0),
      driverMealGst: segMealCalcs.reduce((s, c) => s + c.drvMeal, 0) * 0.18,

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
    if (!validateCreditNoteRows()) return;
    if (intent === "Confirmed" && createAdvance <= 0) {
      showNotif("Enter advance amount to confirm", "error");
      return;
    }
    // B2C-<fiscal year>-<sequence>, e.g. B2C-2627-001. Sequence is the highest
    // existing number for the prefix + 1, so deletions never cause ID reuse.
    const idPrefix = `B2C-${fiscalYearCode()}-`;
    const maxSeq = bookings
      .filter((b) => b.id.startsWith(idPrefix))
      .reduce((m, b) => Math.max(m, parseInt(b.id.slice(idPrefix.length), 10) || 0), 0);
    const id = idPrefix + String(maxSeq + 1).padStart(3, "0");
    let allocatedRooms: string[] = [];
    let segAlloc: Record<string, string[]> = {};
    if (intent === "Tentative" || intent === "Confirmed") {
      const result = tryAssignRooms(
        computedSegments,
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
      segAlloc = result.perSegment;
    }
    const booking = buildNewBooking(id, intent, allocatedRooms, segAlloc);
    createBooking(booking);
    redeemCreditNoteRows(id);
    showNotif(`Booking ${id} saved — ${intent}`, "success");
    if (typeof window !== "undefined") {
      window.open(`/bookings/${id}/confirmation`, "_blank");
    }
    router.push(`/bookings/${id}`);
  };

  const saveEdit = (alsoOpenConfirmation: boolean) => {
    if (!validate() || !initial) return;
    if (!validateCreditNoteRows()) return;
    let allocatedRooms = initial.allocatedRooms;
    // Default: carry over each segment's existing allocation (matched by id)
    let segAlloc: Record<string, string[]> = Object.fromEntries(
      (initial.segments ?? []).map((s) => [s.id, s.allocatedRooms ?? []])
    );
    if (initial.status === "Tentative" || initial.status === "Confirmed") {
      const result = tryAssignRooms(
        computedSegments,
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
      segAlloc = result.perSegment;
    } else if (initial.status === "Enquiry") {
      allocatedRooms = [];
      segAlloc = {};
    }
    updateBooking(initial.id, buildEditPatch(allocatedRooms, segAlloc));
    redeemCreditNoteRows(initial.id);
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
          <h2>{isEdit ? `Edit Booking — ${initial!.id}` : "New Booking"}</h2>
          {!isEdit && <p>Pricing auto-calculates as you fill the form</p>}
        </div>
        {isEdit ? (
          <Link href={`/bookings/${initial!.id}`} className="btn btn-ghost btn-sm">
            View Booking
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

      {/* §2 Accommodation */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span><span className="form-sec-num">2</span>Accommodation</span>
            <button type="button" className="btn btn-sm" onClick={addSegment} style={{ fontSize: 12 }}>
              + Add New Date
            </button>
          </div>

          {formSegs.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <p>Click &quot;+ Add New Date&quot; to add dates and rooms.</p>
            </div>
          ) : (
            formSegs.map((seg, segIdx) => {
              const segNights = nightsBetween(seg.checkin, seg.checkout);
              const segMeal = segMealCalcs[segIdx];
              const { weekday: segWd, friday: segFr, saturday: segSa } = splitNightsByType(seg.checkin, seg.checkout);
              const nightParts = [
                segWd > 0 ? `${segWd} Weekday` : "",
                segFr > 0 ? `${segFr} Fri` : "",
                segSa > 0 ? `${segSa} Sat` : "",
              ].filter(Boolean).join(" · ");
              const ciDay = seg.checkin ? new Date(seg.checkin + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }) : "";
              const coDay = seg.checkout ? new Date(seg.checkout + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }) : "";

              // Compute offset into computedRows for this segment
              let segRowOffset = 0;
              for (const ps of formSegs) {
                if (ps.id === seg.id) break;
                segRowOffset += ps.rows.length;
              }

              return (
                <div
                  key={seg.id}
                  style={{
                    border: "1px solid var(--bd)",
                    borderRadius: "var(--r4)",
                    marginBottom: 16,
                    overflow: "hidden",
                  }}
                >
                  {/* Segment header */}
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "var(--surf2)",
                      borderBottom: "1px solid var(--bd)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>Check-in</span>
                        <input
                          type="date"
                          value={seg.checkin}
                          onChange={(e) => updateSegDates(seg.id, e.target.value, seg.checkout)}
                          style={{ fontSize: 12, padding: "4px 8px", border: "1px solid var(--bd)", borderRadius: "var(--r3)", background: "var(--surf)", outline: "none" }}
                        />
                        {ciDay && <span style={{ fontSize: 11, color: "var(--acc)", fontWeight: 700 }}>{ciDay}</span>}
                      </div>
                      <span style={{ color: "var(--t3)", fontSize: 13 }}>&rarr;</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>Check-out</span>
                        <input
                          type="date"
                          value={seg.checkout}
                          onChange={(e) => updateSegDates(seg.id, seg.checkin, e.target.value)}
                          style={{ fontSize: 12, padding: "4px 8px", border: "1px solid var(--bd)", borderRadius: "var(--r3)", background: "var(--surf)", outline: "none" }}
                        />
                        {coDay && <span style={{ fontSize: 11, color: "var(--acc)", fontWeight: 700 }}>{coDay}</span>}
                      </div>
                      {segNights > 0 && (
                        <span style={{ fontSize: 11, color: "var(--t2)" }}>
                          {segNights} night{segNights > 1 ? "s" : ""}
                          {nightParts ? ` (${nightParts})` : ""}
                        </span>
                      )}
                    </div>
                    {formSegs.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => removeSegment(seg.id)}
                      >
                        Remove Date
                      </button>
                    )}
                  </div>

                  {/* Guest counts for this segment */}
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--bd)", background: "var(--surf)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.04em" }}>Guest Packs Count</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {[
                        { label: "Adults", field: "adults" as keyof FormSeg, min: 1 },
                        { label: "Sr. Citizens", field: "seniors" as keyof FormSeg, min: 0 },
                        { label: "Kids 10–16", field: "kidsAbove10" as keyof FormSeg, min: 0 },
                        { label: "Kids 6–10", field: "kids6to10" as keyof FormSeg, min: 0 },
                        { label: "Infants (0–6)", field: "infants" as keyof FormSeg, min: 0 },
                        { label: "Pets", field: "pets" as keyof FormSeg, min: 0 },
                      ].map(({ label, field, min }) => (
                        <div key={field} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: 10, color: "var(--t3)", fontWeight: 500, whiteSpace: "nowrap" }}>{label}</span>
                          <input
                            type="number"
                            value={seg[field] as string}
                            min={min}
                            onChange={(e) => {
                              let v = parseInt(e.target.value) || 0;
                              if (v < min) v = min;
                              updateSegField(seg.id, field, String(v));
                            }}
                            style={{ width: 52, padding: "4px 6px", border: "1px solid var(--bd)", borderRadius: "var(--r3)", fontSize: 13, textAlign: "center", background: "var(--surf)", outline: "none" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rooms table */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ minWidth: 1100 }}>
                      <thead>
                        <tr>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 180 }}>Room Category</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 100, textAlign: "right" }}>Tariff</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 60, textAlign: "right" }}>Nights</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 60, textAlign: "right" }}>Rooms</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 110, textAlign: "right" }}>Charges</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 70, textAlign: "right" }}>Disc %</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 90 }}>Date Type</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 100, textAlign: "right" }}>Disc Amt</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 110, textAlign: "right" }}>Net</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 60, textAlign: "right" }}>GST %</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 100, textAlign: "right" }}>GST Amt</th>
                          <th style={{ whiteSpace: "nowrap", verticalAlign: "middle", width: 110, textAlign: "right" }}>Total</th>
                          <th style={{ width: 32 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {seg.rows.length === 0 ? (
                          <tr>
                            <td colSpan={13}>
                              <div className="empty-state" style={{ padding: 16 }}>
                                <p>Click &quot;+ Add Room Row&quot; to add rooms for this period.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          seg.rows.map((row, rowI) => {
                            const calc = computedRows[segRowOffset + rowI];
                            if (!calc) return null;
                            const cap = maxDiscountForRowAndRole(row.rowType, currentRole, discountCaps);
                            const overCap = (parseFloat(row.discountPct) || 0) > cap;
                            return (
                              <tr key={row.uid} style={{ cursor: "default" }}>
                                <td style={{ verticalAlign: "middle" }}>
                                  <select
                                    value={row.roomId}
                                    onChange={(e) => onSegRoomChange(seg.id, row.uid, e.target.value)}
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
                                      <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ verticalAlign: "middle" }}>
                                  <input
                                    type="number"
                                    value={row.tariff}
                                    onChange={(e) => setSegRow(seg.id, row.uid, { tariff: e.target.value })}
                                    style={cellInputStyle}
                                  />
                                </td>
                                <td style={{ verticalAlign: "middle" }}>
                                  <input
                                    type="number"
                                    value={row.nights}
                                    readOnly={row.rowType !== "custom"}
                                    onChange={(e) => setSegRow(seg.id, row.uid, { nights: e.target.value })}
                                    style={cellInputStyle}
                                  />
                                </td>
                                <td style={{ verticalAlign: "middle" }}>
                                  <input
                                    type="number"
                                    value={row.numRooms}
                                    min={1}
                                    onChange={(e) => setSegRow(seg.id, row.uid, { numRooms: e.target.value })}
                                    style={cellInputStyle}
                                  />
                                </td>
                                <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: 600, color: "var(--t1)" }}>
                                  {fmt(calc.roomCharges)}
                                </td>
                                <td style={{ verticalAlign: "middle" }}>
                                  <input
                                    type="number"
                                    value={row.discountPct}
                                    min={0}
                                    max={cap}
                                    onChange={(e) => onSegDiscChange(seg.id, row.uid, e.target.value)}
                                    style={cellInputStyle}
                                  />
                                  {overCap && (
                                    <div style={{ fontSize: 9, color: "var(--red)", marginTop: 2 }}>
                                      Max {cap}%
                                    </div>
                                  )}
                                </td>
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
                                <td style={{ textAlign: "right", verticalAlign: "middle", color: "var(--amb)" }}>
                                  {calc.discountAmt > 0 ? `− ${fmt(calc.discountAmt)}` : "—"}
                                </td>
                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                  {fmt(calc.netCharges)}
                                </td>
                                <td style={{ textAlign: "center", verticalAlign: "middle", color: "var(--t3)" }}>
                                  {calc.gstRate > 0 ? `${calc.gstRate}%` : "—"}
                                </td>
                                <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                                  {fmt(calc.gstAmt)}
                                </td>
                                <td style={{ textAlign: "right", verticalAlign: "middle", fontWeight: 700, color: "var(--t1)" }}>
                                  {fmt(calc.totalAmt)}
                                </td>
                                <td style={{ verticalAlign: "middle" }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    onClick={() => removeSegRow(seg.id, row.uid)}
                                    title="Remove row"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {seg.rows.some((r) => r.roomId) && (
                          <tr style={{ background: "var(--surf2)" }}>
                            <td colSpan={11} style={{ textAlign: "right", fontWeight: 700, color: "var(--t1)", padding: "8px 10px" }}>
                              Room Total
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 800, color: "var(--sb)", fontSize: 14, padding: "8px 10px" }}>
                              {fmt(computedRows.slice(segRowOffset, segRowOffset + seg.rows.length).reduce((s, r) => s + r.totalAmt, 0))}
                            </td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add room row button */}
                  <div style={{ padding: "8px 14px", borderTop: "1px solid var(--bd)" }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => addSegRoom(seg.id)}
                    >
                      + Add Room Row
                    </button>
                  </div>

                  {/* Meal package for this segment */}
                  <div style={{ padding: "12px 14px", borderTop: "1px solid var(--bd)", background: "var(--surf)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Meal Charges</div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>Include Meal Charges?</span>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                        <input type="radio" name={`meal-${seg.id}`} checked={seg.mealOn} onChange={() => updateSegField(seg.id, "mealOn", true)} /> Yes
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                        <input type="radio" name={`meal-${seg.id}`} checked={!seg.mealOn} onChange={() => updateSegField(seg.id, "mealOn", false)} /> No
                      </label>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", marginLeft: 8 }}>Drivers / Attendants</span>
                      <input
                        type="number"
                        value={seg.drivers}
                        min={0}
                        onChange={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          updateSegField(seg.id, "drivers", String(v));
                          if (v === 0) updateSegField(seg.id, "driverMealOn", false);
                        }}
                        style={{ width: 52, padding: "4px 6px", border: "1px solid var(--bd)", borderRadius: "var(--r3)", fontSize: 13, textAlign: "center", background: "var(--surf)", outline: "none" }}
                      />
                      {segMeal.driversN > 0 && (
                        <>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>Driver Meal?</span>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                            <input type="radio" name={`driverMeal-${seg.id}`} checked={seg.driverMealOn} onChange={() => updateSegField(seg.id, "driverMealOn", true)} /> Yes
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                            <input type="radio" name={`driverMeal-${seg.id}`} checked={!seg.driverMealOn} onChange={() => updateSegField(seg.id, "driverMealOn", false)} /> No
                          </label>
                        </>
                      )}
                    </div>
                    {(seg.mealOn || segMeal.petsN > 0 || (seg.driverMealOn && segMeal.driversN > 0)) ? (
                      <table>
                        <thead>
                          <tr>
                            <th style={{ whiteSpace: "nowrap" }}>Charge</th>
                            <th style={{ whiteSpace: "nowrap", textAlign: "right", width: 110 }}>Rate</th>
                            <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Nights</th>
                            <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Pax</th>
                            <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Charges</th>
                            <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST %</th>
                            <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST Amt</th>
                            <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seg.mealOn && (
                            <tr style={{ cursor: "default" }}>
                              <td><strong>Meal &amp; Activity Package</strong></td>
                              <td style={{ verticalAlign: "middle" }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={seg.mealRate}
                                  onChange={(e) => updateSegField(seg.id, "mealRate", e.target.value)}
                                  style={cellInputStyle}
                                />
                              </td>
                              <td style={{ textAlign: "right" }}>{segMeal.nights}</td>
                              <td style={{ textAlign: "right" }}>{segMeal.adultsN}</td>
                              <td style={{ textAlign: "right" }}>{fmt(segMeal.meal)}</td>
                              <td style={{ textAlign: "right" }}>18%</td>
                              <td style={{ textAlign: "right" }}>{fmt(segMeal.meal * 0.18)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(segMeal.meal * 1.18)}</td>
                            </tr>
                          )}
                          {segMeal.petsN > 0 && (
                            <tr style={{ cursor: "default" }}>
                              <td><strong>Pet Package</strong></td>
                              <td style={{ verticalAlign: "middle" }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={seg.petRate}
                                  onChange={(e) => updateSegField(seg.id, "petRate", e.target.value)}
                                  style={cellInputStyle}
                                />
                              </td>
                              <td style={{ textAlign: "right" }}>{segMeal.nights}</td>
                              <td style={{ textAlign: "right" }}>{segMeal.petsN}</td>
                              <td style={{ textAlign: "right" }}>{fmt(segMeal.pet)}</td>
                              <td style={{ textAlign: "right" }}>18%</td>
                              <td style={{ textAlign: "right" }}>{fmt(segMeal.pet * 0.18)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(segMeal.pet * 1.18)}</td>
                            </tr>
                          )}
                          {seg.driverMealOn && segMeal.driversN > 0 && (
                            <tr style={{ cursor: "default" }}>
                              <td><strong>Driver / Attendant Meal</strong></td>
                              <td style={{ verticalAlign: "middle" }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={seg.driverMealRate}
                                  onChange={(e) => updateSegField(seg.id, "driverMealRate", e.target.value)}
                                  style={cellInputStyle}
                                />
                              </td>
                              <td style={{ textAlign: "right" }}>{segMeal.nights}</td>
                              <td style={{ textAlign: "right" }}>{segMeal.driversN}</td>
                              <td style={{ textAlign: "right" }}>{fmt(segMeal.drvMeal)}</td>
                              <td style={{ textAlign: "right" }}>18%</td>
                              <td style={{ textAlign: "right" }}>{fmt(segMeal.drvMeal * 0.18)}</td>
                              <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(segMeal.drvMeal * 1.18)}</td>
                            </tr>
                          )}
                          <tr style={{ background: "var(--surf2)" }}>
                            <td colSpan={7} style={{ textAlign: "right", fontWeight: 700, color: "var(--t1)" }}>
                              Meal Total (this segment)
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 800, color: "var(--sb)", fontSize: 14 }}>
                              {fmt(segMeal.total)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--t3)" }}>
                        No meal charges added. Toggle Yes above to include meals, or add pets to show pet charges.
                      </div>
                    )}
                  </div>

                  {/* Segment Grand Total */}
                  {(seg.rows.some((r) => r.roomId) || segMeal.total > 0) && (
                    <div style={{ padding: "10px 14px", borderTop: "2px solid var(--bd)", background: "var(--surf2)", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>Segment Total</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--sb)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
                        {fmt(computedRows.slice(segRowOffset, segRowOffset + seg.rows.length).reduce((s, r) => s + r.totalAmt, 0) + segMeal.total)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Grand total */}
          {formSegs.some((s) => s.rows.some((r) => r.roomId)) && (
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
              <table style={{ minWidth: 320 }}>
                <tbody>
                  <tr style={{ background: "var(--surf2)" }}>
                    <td colSpan={11} style={{ textAlign: "right", fontWeight: 700, color: "var(--t1)", padding: "8px 12px" }}>
                      Total Room Charges
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800, color: "var(--sb)", fontSize: 14, padding: "8px 12px" }}>
                      {fmt(totalRoomCharges)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* §3 Add On Charges */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">3</span>Add-on Charges
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

      {/* §4 Amount Due */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">4</span>Amount Due
          </div>
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
                  <td>Room Charges</td>
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
                    <td>Meal Charges</td>
                    <td style={{ textAlign: "right" }}>
                      {fmt(segMealCalcs.reduce((s, c) => s + c.base, 0))}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {fmt(segMealCalcs.reduce((s, c) => s + c.gst, 0))}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totalMealPet)}</td>
                  </tr>
                )}
                {totalAddOn > 0 && (
                  <tr style={{ cursor: "default" }}>
                    <td>Add-on Charges</td>
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
        </div>
      </div>

      {/* §5 Payment Received */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">5</span>Payment Received
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
                    {row.mode === "Credit Note" && (
                      <div style={{ marginTop: 5 }}>
                        <input
                          type="text"
                          placeholder="Credit note code"
                          value={row.cnCode}
                          onChange={(e) => setNewPaymentRows((prev) =>
                            prev.map((r) => r.uid === row.uid ? { ...r, cnCode: e.target.value } : r)
                          )}
                          style={{ width: "100%", padding: "5px 8px", border: "1px solid var(--bd)", borderRadius: "var(--r3)", fontSize: 12, background: "var(--surf)", outline: "none" }}
                        />
                        {row.cnCode.trim() && (() => {
                          const cn = creditNotes.find((c) => c.code.toLowerCase() === row.cnCode.trim().toLowerCase());
                          if (!cn) return <div style={{ fontSize: 10, marginTop: 3, color: "var(--red)" }}>Code not found</div>;
                          return (
                            <div style={{ fontSize: 10, marginTop: 3, color: cn.remainingAmount > 0 ? "var(--grn)" : "var(--red)" }}>
                              {cn.guestName} · {fmt(cn.remainingAmount)} available
                            </div>
                          );
                        })()}
                      </div>
                    )}
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
              { uid: newUid(), date: todayDate, amount: "", mode: "Bank Transfer", cnCode: "" },
            ])}
          >
            + Add Row
          </button>
          <div
            className="detail-row"
            style={{
              marginTop: 14,
              background: "var(--surf2)",
              padding: "10px 12px",
              borderRadius: "var(--r2)",
            }}
          >
            <span className="detail-key" style={{ fontWeight: 600 }}>Total Payment Received</span>
            <span className="detail-val" style={{ fontWeight: 800, fontSize: 16 }}>
              {fmt(totalReceived)}
            </span>
          </div>
          <div
            className="detail-row"
            style={{
              marginTop: 8,
              background: balance > 0 ? "var(--amb-lt)" : "var(--grn-lt)",
              padding: "10px 12px",
              borderRadius: "var(--r2)",
            }}
          >
            <span className="detail-key" style={{ fontWeight: 600 }}>Balance Amount</span>
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
