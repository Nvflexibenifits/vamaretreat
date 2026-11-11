import type {
  B2BBooking,
  B2BStatus,
  Booking,
  BookingKind,
  BookingSegment,
  BookingStatus,
  BulkRoomBlock,
  ChargeHead,
  DiscountCaps,
  Extra,
  GstSettings,
  Payment,
  PricingRow,
  PricingRowType,
  Role,
  RoomInventoryItem,
  RoomMaster,
  RoomNightOverride,
  SegmentRoom,
  VenueBlock,
} from "@/types";
import { DEPOSIT_MODE } from "@/types";
import { ROOM_INVENTORY, ROOMS, SEED_GST_SETTINGS } from "@/lib/data";

export const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

// Indian numeric date format: DD/MM/YYYY. Accepts ISO YYYY-MM-DD strings.
export function fmtIN(dateStr: string | undefined | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function dayName(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

export function nightsBetween(checkin: string, checkout: string): number {
  if (!checkin || !checkout || checkout <= checkin) return 0;
  return Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// Indian fiscal year code (April–March), e.g. July 2026 -> "2627" (FY 2026-27)
export function fiscalYearCode(now: Date = new Date()): string {
  const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${String(startYear % 100).padStart(2, "0")}${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function getTimeOfDay(now: Date = new Date()): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

// B2B status as of today. B2C bookings get Lost and Completed written back
// by the store's sweeps; B2B rows are read instead, so nothing in the past is
// rewritten: an enquiry or tentative whose check-in has passed is lost, a
// confirmed booking whose check-out has passed is completed.
export function b2bStatusNow(
  b: Pick<B2BBooking, "status" | "checkin" | "checkout">,
  today: string
): B2BStatus {
  if (b.status === "Lost" || b.status === "Completed" || b.status === "Cancelled") return b.status;
  if ((b.status === "Enquiry" || b.status === "Tentative") && b.checkin < today) return "Lost";
  if (b.status === "Confirmed" && b.checkout < today) return "Completed";
  return b.status;
}

export function statusBadgeClass(s: BookingStatus): string {
  const m: Record<BookingStatus, string> = {
    Enquiry: "bd-draft",
    Tentative: "bd-active",
    Confirmed: "bd-confirmed",
    Completed: "bd-completed",
    Lost: "bd-lost",
    Cancelled: "bd-cancelled",
  };
  return m[s];
}

export function statusBadgeDot(_s: BookingStatus): string {
  return "";
}

export function maxDiscountForRole(role: Role, caps: DiscountCaps): number {
  if (role === "Admin") return caps.admin ?? 100;
  return caps.sales;
}

export function maxDiscountForRowAndRole(
  _rowType: PricingRow["rowType"],
  _role: Role,
  _caps: DiscountCaps
): number {
  // Caps disabled for now — any discount up to 100% is allowed for every
  // role and day type. Restore day/role rules here if they come back.
  return 100;
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function nowTime(): string {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function weekRange(dateStr: string = todayStr()): { start: string; end: string } {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export function sevenDaysFrom(dateStr: string): string[] {
  const out: string[] = [];
  const d = new Date(dateStr);
  for (let i = 0; i < 7; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    out.push(next.toISOString().split("T")[0]);
  }
  return out;
}

export function formatLongDate(d: Date = new Date()): string {
  const weekday = d.toLocaleDateString("en-IN", { weekday: "long" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${weekday}, ${dd}/${mm}/${yyyy}`;
}

// ─────── PRICING / ROW HELPERS ───────
export function splitNightsByType(checkin: string, checkout: string): { weekday: number; friday: number; saturday: number } {
  let weekday = 0;
  let friday = 0;
  let saturday = 0;
  if (!checkin || !checkout || checkout <= checkin) return { weekday, friday, saturday };
  const cur = new Date(checkin);
  const end = new Date(checkout);
  while (cur < end) {
    const d = cur.getDay();
    if (d === 5) friday++;
    else if (d === 6) saturday++;
    else weekday++;
    cur.setDate(cur.getDate() + 1);
  }
  return { weekday, friday, saturday };
}

export function calcPricingRow(
  rowType: PricingRow["rowType"],
  roomId: string,
  tariff: number,
  nights: number,
  numRooms: number,
  discountPct: number,
  gstSettings: GstSettings = SEED_GST_SETTINGS,
  roomMaster: RoomMaster[] = ROOMS
): PricingRow {
  const room = roomMaster.find((r) => r.id === roomId);
  // GST slab is decided by the per-night rate the guest actually pays
  // (tariff net of discount), not the rack tariff.
  const netRate = tariff * (1 - discountPct / 100);
  const gstRate = netRate > gstSettings.threshold ? gstSettings.aboveRate : gstSettings.belowRate;
  const roomCharges = tariff * nights * numRooms;
  const discountAmt = roomCharges * (discountPct / 100);
  const netCharges = roomCharges - discountAmt;
  const gstAmt = netCharges * (gstRate / 100);
  const totalAmt = netCharges + gstAmt;
  return {
    rowType,
    roomId,
    roomName: room?.name ?? "",
    checkin: "",
    checkout: "",
    tariff,
    nights,
    numRooms,
    roomCharges,
    discountPct,
    discountAmt,
    netCharges,
    gstRate,
    gstAmt,
    totalAmt,
  };
}

export function calcSegmentRoom(
  checkin: string,
  checkout: string,
  roomId: string,
  numRooms: number,
  discountPct: number,
  roomMaster: RoomMaster[] = ROOMS,
  gstSettings: GstSettings = SEED_GST_SETTINGS
): Pick<SegmentRoom, "pricingRows" | "netCharges" | "gstAmt" | "totalAmt"> {
  const room = roomMaster.find((r) => r.id === roomId);
  if (!room || !checkin || !checkout || checkout <= checkin) {
    return { pricingRows: [], netCharges: 0, gstAmt: 0, totalAmt: 0 };
  }
  const { weekday, friday, saturday } = splitNightsByType(checkin, checkout);
  const pricingRows: PricingRow[] = [];
  if (weekday > 0) {
    pricingRows.push({
      ...calcPricingRow("sun-thu", roomId, room.price, weekday, numRooms, discountPct, gstSettings, roomMaster),
      checkin, checkout,
    });
  }
  if (friday > 0) {
    pricingRows.push({
      ...calcPricingRow("fri", roomId, room.price, friday, numRooms, discountPct, gstSettings, roomMaster),
      checkin, checkout,
    });
  }
  if (saturday > 0) {
    pricingRows.push({
      ...calcPricingRow("sat", roomId, room.price, saturday, numRooms, discountPct, gstSettings, roomMaster),
      checkin, checkout,
    });
  }
  const netCharges = pricingRows.reduce((s, r) => s + r.netCharges, 0);
  const gstAmt = pricingRows.reduce((s, r) => s + r.gstAmt, 0);
  const totalAmt = pricingRows.reduce((s, r) => s + r.totalAmt, 0);
  return { pricingRows, netCharges, gstAmt, totalAmt };
}

export function getBookingPricingRows(b: Booking): PricingRow[] {
  return b.segments.flatMap((seg) =>
    seg.rooms.flatMap((r) =>
      r.pricingRows.map((pr) => ({ ...pr, checkin: seg.checkin, checkout: seg.checkout }))
    )
  );
}

// One line of the guest-facing pricing sheet: a run of consecutive nights for
// one category at one rate, with the exact check-in and check-out of that run.
export type PricingSheetLine = {
  roomName: string;
  checkin: string;
  checkout: string;
  nights: number;
  tariff: number;
  discountPct: number;
  numRooms: number;
  roomCharges: number;
  discountAmt: number;
  netCharges: number;
  gstRate: number;
  gstAmt: number;
  totalAmt: number;
};

function nightRateType(date: string): "fri" | "sat" | "sun-thu" {
  const day = new Date(date + "T00:00:00").getDay();
  return day === 5 ? "fri" : day === 6 ? "sat" : "sun-thu";
}

function rowCoversNight(rowType: PricingRowType, date: string): boolean {
  const t = nightRateType(date);
  if (rowType === "fri-sat") return t === "fri" || t === "sat";
  return rowType === t;
}

// Pricing rows are stored per rate type (weekday, Friday, Saturday) and only
// carry the whole segment's dates, so a Sat + Sun stay prints as two rows that
// both read "12th to 14th". This spreads every row over the nights it actually
// prices, then joins consecutive nights that share a category, tariff,
// discount and room count into a single line. Custom rows have no weekday
// meaning and stay as stored.
export function pricingSheetLines(b: Booking): PricingSheetLine[] {
  const out: PricingSheetLine[] = [];
  (b.segments ?? []).forEach((seg) => {
    const segNights: string[] = [];
    for (let d = seg.checkin; d < seg.checkout; d = nextDay(d)) segNights.push(d);
    seg.rooms.forEach((room) => {
      const nightly: PricingSheetLine[] = [];
      const asStored: PricingSheetLine[] = [];
      room.pricingRows.forEach((pr) => {
        const base = {
          roomName: pr.roomName || room.roomName,
          tariff: pr.tariff,
          discountPct: pr.discountPct,
          numRooms: pr.numRooms,
          gstRate: pr.gstRate,
        };
        const covered = pr.rowType === "custom" ? [] : segNights.filter((d) => rowCoversNight(pr.rowType, d));
        if (covered.length === 0 || covered.length !== pr.nights) {
          asStored.push({
            ...base,
            checkin: seg.checkin,
            checkout: seg.checkout,
            nights: pr.nights,
            roomCharges: pr.roomCharges,
            discountAmt: pr.discountAmt,
            netCharges: pr.netCharges,
            gstAmt: pr.gstAmt,
            totalAmt: pr.totalAmt,
          });
          return;
        }
        const n = covered.length;
        covered.forEach((d) =>
          nightly.push({
            ...base,
            checkin: d,
            checkout: nextDay(d),
            nights: 1,
            roomCharges: pr.roomCharges / n,
            discountAmt: pr.discountAmt / n,
            netCharges: pr.netCharges / n,
            gstAmt: pr.gstAmt / n,
            totalAmt: pr.totalAmt / n,
          })
        );
      });
      nightly.sort((a, c) => a.checkin.localeCompare(c.checkin));
      nightly.forEach((line) => {
        const prev = out[out.length - 1];
        const joinable =
          prev &&
          prev.roomName === line.roomName &&
          prev.checkout === line.checkin &&
          prev.tariff === line.tariff &&
          prev.discountPct === line.discountPct &&
          prev.numRooms === line.numRooms &&
          prev.gstRate === line.gstRate;
        if (joinable) {
          prev.checkout = line.checkout;
          prev.nights += 1;
          prev.roomCharges += line.roomCharges;
          prev.discountAmt += line.discountAmt;
          prev.netCharges += line.netCharges;
          prev.gstAmt += line.gstAmt;
          prev.totalAmt += line.totalAmt;
        } else {
          out.push({ ...line });
        }
      });
      out.push(...asStored);
    });
  });
  return out;
}

// Whether a booking's charges belong in revenue reporting. A stay that has
// checked out is the most realised revenue there is, so Completed counts just
// as Confirmed does; Cancelled counts because a cancellation can still retain
// a charge or a credit note. Tentative / Enquiry / Lost are not earned yet.
// Credit-note value redeemed against a booking. Recorded as a payment with
// mode "Credit Note"; the creditNoteApplied field is the older shape.
export function creditNoteRedeemed(b: Booking): number {
  const fromPayments = (b.payments ?? [])
    .filter((p) => (p.mode || "").toLowerCase().includes("credit note"))
    .reduce((s, p) => s + p.amount, 0);
  if (fromPayments > 0) return fromPayments;
  return b.creditNoteApplied?.amount ?? 0;
}

// Meal-side charges as the booking actually bills them.
//
// `mealTotal` / `mealGst` are stored as the whole meal base for the stay, and
// that base already includes the pet package: the booking form computes
// `base = meal + pet`. `petTotal` / `petGst` are a breakdown of a line that
// already sits inside those figures, kept so the pet can be shown as its own
// row. Adding them on top of `mealTotal` double-counts the pet — `grandTotal`
// counts it once, so anything that adds both disagrees with what the guest owes.
export function bookingMealCharges(b: Booking): { net: number; gst: number } {
  return {
    net: b.mealTotal + (b.driverMealTotal ?? 0),
    gst: b.mealGst + (b.driverMealGst ?? 0),
  };
}

export function countsAsRevenue(b: Booking): boolean {
  return (
    b.status === "Confirmed" ||
    b.status === "Completed" ||
    b.status === "Cancelled"
  );
}

// Add-on categories offered on the booking form, mapped to the revenue head
// each one reports under.
const ADD_ON_CATEGORY_HEADS: Record<string, ChargeHead> = {
  "room charges": "room",
  "meal charges": "meal",
  "venue charges": "other",
};

// Which revenue head an add-on reports under. Rows saved with an explicit head
// use it; legacy rows (saved before the head existed, or added from the
// checkout modal as free text) fall back to their name — the form's category
// labels and auto-generated room-upgrade lines resolve, everything else lands
// in Other.
// Whether a segment carries the pet package. Segments saved before the
// package became optional have no flag and were always charged for pets.
export function petPackageOn(seg: { pets?: number; petMealOn?: boolean }): boolean {
  return (seg.pets ?? 0) > 0 && seg.petMealOn !== false;
}

export function extraHead(e: Extra): ChargeHead {
  if (e.head) return e.head;
  const name = (e.name ?? "").trim().toLowerCase();
  const byCategory = ADD_ON_CATEGORY_HEADS[name];
  if (byCategory) return byCategory;
  if (name.startsWith("room upgrade") || name.startsWith("room charges")) return "room";
  return "other";
}

// What an add-on line is called on screen and on paper. A paid room upgrade
// used to be written as "Room Upgrade (date): from → to"; finance wants it
// read as room charges, so lines saved under the old prefix show the new one
// without the stored row changing.
export function extraLabel(e: Extra): string {
  const name = (e.name ?? "").trim();
  return name.replace(/^Room Upgrade\b/i, "Room Charges");
}

export type BookingChargesBreakdown = {
  roomNet: number;
  mealNet: number;
  // Credit-note value redeemed against this booking. Already netted out of
  // every figure below — carried here only so the register can show it.
  creditNoteUsed: number;
  // Every non-room/meal charge: the itemised add-ons plus the unnamed legacy
  // remainder. Kept as the aggregate so callers that report a single Other
  // figure (dashboard card, waive-off caps) stay correct.
  other: number;
  // The itemised part of `other`, split by the add-on's own label so the
  // Revenue Register can give each service its own column. Whatever `other`
  // holds beyond the sum of these is the unnamed legacy remainder.
  otherByItem: Record<string, number>;
  gst5: number;
  gst18: number;
  gstOther: number;
};

// Charge-side view of a booking as the Revenue Register reports it: net
// room/meal/other excluding GST, with GST split by rate. A redeemed credit
// note is deducted head by head — room, then meal, then other services.
// Refund cancellations
// contribute nothing here — their revenue leaves with the refund and only the
// cancellation charge (handled by the caller) is kept. Credit-note
// cancellations keep full revenue: no money leaves, the stay obligation
// remains. The dashboard Revenue card sums roomNet + mealNet + other so it
// always matches the register's Total Charges.
export function bookingChargesBreakdown(b: Booking): BookingChargesBreakdown {
  const isRefundCancel =
    b.status === "Cancelled" && b.cancellationDetails?.resolution === "refund";
  if (isRefundCancel) {
    return { roomNet: 0, mealNet: 0, creditNoteUsed: 0, other: 0, otherByItem: {}, gst5: 0, gst18: 0, gstOther: 0 };
  }

  // GST is tracked per head as well as per rate: a credit note is consumed
  // head by head, so each head has to carry its own GST with it.
  type GstByRate = { g5: number; g18: number; gOther: number };
  const zeroGst = (): GstByRate => ({ g5: 0, g18: 0, gOther: 0 });
  const addGst = (t: GstByRate, amt: number, pct: number) => {
    if (amt === 0) return;
    if (pct === 5) t.g5 += amt;
    else if (pct === 18) t.g18 += amt;
    else t.gOther += amt;
  };
  const sumGst = (t: GstByRate) => t.g5 + t.g18 + t.gOther;
  const scaleGst = (t: GstByRate, f: number) => {
    t.g5 *= f;
    t.g18 *= f;
    t.gOther *= f;
  };

  const pricingRows = getBookingPricingRows(b);
  let roomNet = pricingRows.reduce((s2, r) => s2 + r.netCharges, 0);
  const roomGst = zeroGst();
  pricingRows.forEach((r) => {
    if (r.gstAmt <= 0) return;
    addGst(roomGst, r.gstAmt, r.gstRate === 5 ? 5 : 18);
  });

  const mealCharges = bookingMealCharges(b);
  let mealNet = mealCharges.net;
  const mealGst = zeroGst();
  addGst(mealGst, mealCharges.gst, 18);

  // Itemized add-ons: the net amount reports under the head its category maps
  // to (room / meal add-ons join their own columns, venue and anything
  // uncategorised fall to Other). GST is bucketed by its actual rate.
  const extrasList = b.extras ?? [];
  let extrasNet = 0;
  let extrasGst = 0;
  const otherItems: Record<string, { net: number; gst: GstByRate }> = {};
  extrasList.forEach((e) => {
    extrasNet += e.amount;
    const gst = e.gst ?? 0;
    const pct = e.amount > 0 && gst > 0 ? Math.round((gst / e.amount) * 100) : 0;
    extrasGst += gst;
    const head = extraHead(e);
    if (head === "room") {
      roomNet += e.amount;
      addGst(roomGst, gst, pct);
    } else if (head === "meal") {
      mealNet += e.amount;
      addGst(mealGst, gst, pct);
    } else {
      const label = (e.name ?? "").trim() || "Add-on Charge";
      const bucket = (otherItems[label] ??= { net: 0, gst: zeroGst() });
      bucket.net += e.amount;
      addGst(bucket.gst, gst, pct);
    }
  });

  // Legacy bookings rolled add-ons into grandTotal without itemizing;
  // whatever the itemized extras don't explain stays as a gross remainder and
  // has no item of its own to sit under.
  let otherRemainder = Math.max(
    0,
    b.grandTotal - b.totalRoomCharges - b.totalMealCharges - extrasNet - extrasGst
  );
  const itemisedOther = Object.values(otherItems).reduce((s2, v) => s2 + v.net, 0);

  // Cancellation waive-off: the unpaid balance written off per head leaves
  // the booking's stored figures intact but comes out of reported revenue.
  (b.waiveOff?.lines ?? []).forEach((l) => {
    const pct = Math.round(l.gstPct);
    if (l.head === "room") {
      roomNet -= l.amount;
      addGst(roomGst, -l.gstAmt, pct);
      return;
    }
    if (l.head === "meal") {
      mealNet -= l.amount;
      addGst(mealGst, -l.gstAmt, pct);
      return;
    }
    // Other head: the unnamed remainder absorbs it first, then the itemised
    // buckets pro rata, so item columns and Other still add up.
    const fromRemainder = Math.min(otherRemainder, l.amount);
    otherRemainder -= fromRemainder;
    const fromItems = l.amount - fromRemainder;
    if (fromItems > 0 && itemisedOther > 0) {
      const factor = Math.max(0, 1 - fromItems / itemisedOther);
      Object.values(otherItems).forEach((v) => {
        v.net = Math.max(0, v.net * factor);
        scaleGst(v.gst, factor);
      });
    }
    if (l.gstAmt > 0 && itemisedOther > 0) {
      const gstTotal = Object.values(otherItems).reduce((s2, v) => s2 + sumGst(v.gst), 0);
      if (gstTotal > 0) {
        const factor = Math.max(0, 1 - l.gstAmt / gstTotal);
        Object.values(otherItems).forEach((v) => scaleGst(v.gst, factor));
      }
    }
  });

  roomNet = Math.max(0, roomNet);
  mealNet = Math.max(0, mealNet);
  otherRemainder = Math.max(0, otherRemainder);
  (["g5", "g18", "gOther"] as const).forEach((k) => {
    roomGst[k] = Math.max(0, roomGst[k]);
    mealGst[k] = Math.max(0, mealGst[k]);
  });

  // A redeemed credit note was already recognised as revenue on the booking
  // that issued it, so this booking only earns what it charges beyond the
  // note. The note is consumed head by head in order — room charges first,
  // then meal, then other services — rather than spread across all of them.
  // Each head is drawn down on its gross (net + its own GST), so the net and
  // GST it contributes fall together.
  const creditNoteUsed = creditNoteRedeemed(b);
  if (creditNoteUsed > 0) {
    let remaining = creditNoteUsed;

    // Draw `remaining` down against one head's gross value, returning the
    // factor that head's figures must be scaled by.
    const drawDown = (gross: number): number => {
      if (remaining <= 0 || gross <= 0) return 1;
      const take = Math.min(remaining, gross);
      remaining -= take;
      return Math.max(0, 1 - take / gross);
    };

    const roomFactor = drawDown(roomNet + sumGst(roomGst));
    roomNet *= roomFactor;
    scaleGst(roomGst, roomFactor);

    const mealFactor = drawDown(mealNet + sumGst(mealGst));
    mealNet *= mealFactor;
    scaleGst(mealGst, mealFactor);

    // Within Other there is no further ordering, so whatever is left comes
    // off the remainder and every service line pro rata.
    const otherGross =
      otherRemainder +
      Object.values(otherItems).reduce((s2, v) => s2 + v.net + sumGst(v.gst), 0);
    const otherFactor = drawDown(otherGross);
    otherRemainder *= otherFactor;
    Object.values(otherItems).forEach((v) => {
      v.net *= otherFactor;
      scaleGst(v.gst, otherFactor);
    });
  }

  const otherByItem: Record<string, number> = {};
  Object.entries(otherItems).forEach(([label, v]) => {
    otherByItem[label] = v.net;
  });
  const other =
    otherRemainder + Object.values(otherItems).reduce((s2, v) => s2 + v.net, 0);

  const itemGst = Object.values(otherItems).reduce(
    (t, v) => {
      t.g5 += v.gst.g5;
      t.g18 += v.gst.g18;
      t.gOther += v.gst.gOther;
      return t;
    },
    zeroGst()
  );
  const gst5 = Math.max(0, roomGst.g5 + mealGst.g5 + itemGst.g5);
  const gst18 = Math.max(0, roomGst.g18 + mealGst.g18 + itemGst.g18);
  const gstOther = Math.max(0, roomGst.gOther + mealGst.gOther + itemGst.gOther);

  return { roomNet, mealNet, creditNoteUsed, other, otherByItem, gst5, gst18, gstOther };
}

// Charge-side view of a B2B booking. Phase 1 B2B has no room or meal stay
// charges of its own — everything it bills sits in add-on lines, which report
// under the head their master item maps to, exactly as on a B2C booking.
export function b2bChargesBreakdown(b: B2BBooking): BookingChargesBreakdown {
  let roomNet = 0;
  let mealNet = 0;
  let gst5 = 0;
  let gst18 = 0;
  let gstOther = 0;
  const otherByItem: Record<string, number> = {};

  (b.extras ?? []).forEach((e) => {
    const head = extraHead(e);
    if (head === "room") roomNet += e.amount;
    else if (head === "meal") mealNet += e.amount;
    else {
      const label = (e.name ?? "").trim() || "Add-on Charge";
      otherByItem[label] = (otherByItem[label] ?? 0) + e.amount;
    }
    const gst = e.gst ?? 0;
    if (gst <= 0) return;
    const pct = e.amount > 0 ? Math.round((gst / e.amount) * 100) : 0;
    if (pct === 5) gst5 += gst;
    else if (pct === 18) gst18 += gst;
    else gstOther += gst;
  });

  const other = Object.values(otherByItem).reduce((s, v) => s + v, 0);
  return { roomNet, mealNet, creditNoteUsed: 0, other, otherByItem, gst5, gst18, gstOther };
}

// ─────── BALANCE ───────
// A booking's balance is signed: positive means the guest still owes,
// negative means the hotel holds more than the bill (excess received).
// Callers that want "money still to collect" clamp at read time with
// amountDue(); the stored value must keep the sign so an overpayment is
// never mistaken for a settled booking.
export function signedBalance(payable: number, received: number): number {
  // Whole rupees: GST maths produces paise, guests pay rounded amounts, so a
  // sub-rupee remainder must not read as pending or as excess.
  return Math.round(payable - received);
}

export function amountDue(balance: number): number {
  return balance >= 1 ? balance : 0;
}

export function excessReceived(balance: number): number {
  return balance <= -1 ? -balance : 0;
}

// ─────── PENDING PAYMENTS ───────
// One row of money still owed by a guest or organisation. Only bookings the
// guest has committed to count: Confirmed stays and Completed stays that
// checked out with a balance. Enquiry and Tentative are not receivables, and
// Cancelled and Lost settle through their own flows.
export type PendingPayment = {
  id: string;
  kind: "b2c" | "b2b";
  name: string;
  contact: string;
  checkin: string;
  checkout: string;
  grandTotal: number;
  received: number;
  balance: number;
  href: string;
};

export function pendingPayments(bookings: Booking[], b2bBookings: B2BBooking[]): PendingPayment[] {
  const rows: PendingPayment[] = [];
  bookings.forEach((b) => {
    if ((b.status !== "Confirmed" && b.status !== "Completed") || b.balance < 1) return;
    rows.push({
      id: b.id, kind: "b2c", name: b.guest, contact: b.mobile, checkin: b.checkin, checkout: b.checkout,
      grandTotal: b.grandTotal, received: b.advance, balance: b.balance, href: `/bookings/${b.id}`,
    });
  });
  b2bBookings.forEach((b) => {
    if (b.status !== "Confirmed" || b.balance < 1) return;
    rows.push({
      id: b.id, kind: "b2b", name: b.orgName, contact: b.contactNumber, checkin: b.checkin, checkout: b.checkout,
      grandTotal: b.grandTotal, received: b.advance, balance: b.balance, href: `/b2b/${b.id}`,
    });
  });
  return rows.sort((a, b) => a.checkin.localeCompare(b.checkin));
}

// ─────── PAYMENTS ───────
export function isCreditNotePayment(p: Payment): boolean {
  return (p.mode || "").toLowerCase().includes("credit note");
}

// Money received on a booking split by how it arrived. Credit note payments
// bring no new money in, so callers that want cash actually received must use
// bank + cash only. Legacy bookings may carry an advance without itemized
// payments; that advance is treated as bank money.
export function paymentSplit(b: Booking): { bank: number; cash: number; crNote: number; deposit: number } {
  let bank = 0, cash = 0, crNote = 0, deposit = 0;
  (b.payments ?? []).forEach((p) => {
    if (isTdsPayment(p)) return;
    const m = (p.mode || "").toLowerCase();
    if (isDepositAppliedPayment(p)) deposit += p.amount;
    else if (m.includes("cash")) cash += p.amount;
    else if (m.includes("credit note")) crNote += p.amount;
    else bank += p.amount;
  });
  if (bank + cash + crNote + deposit === 0 && b.advance > 0) bank = b.advance;
  return { bank, cash, crNote, deposit };
}

// ─────── OTA ADD-ON SEGREGATION ───────
// An OTA sells the room, with whatever meal plan was booked through it, and
// settles that part net of its commission and TDS. Anything the guest adds at
// the hotel (a meal, an upgrade, a service) is bought from the hotel and paid
// to the hotel: Direct revenue with its own receipts, never an OTA
// receivable. The split is read from the booking as stored: the add-ons are
// the itemised extras, and their receipts are the payments linked to them.

export function isAddOnPayment(p: Payment): boolean {
  return !!p.extraId || p.type === "Add-on";
}

function addOnGross(e: Extra): number {
  return e.amount + (e.gst ?? 0);
}

// Which side of an OTA booking a receipt settles. Linked add-on receipts are
// direct. Older bookings recorded the guest's add-on payment without a link,
// so when nothing is linked a receipt for exactly one add-on, or for all of
// them, is read as that payment. Everything else is the OTA's payout.
export function otaReceiptSide(b: Booking, p: Payment): "direct" | "ota" {
  if (b.source !== "OTA") return "direct";
  if (isAddOnPayment(p)) return "direct";
  const extras = b.extras ?? [];
  if (extras.length === 0 || (b.payments ?? []).some(isAddOnPayment)) return "ota";
  const amt = Math.round(p.amount);
  if (amt <= 0) return "ota";
  const whole = Math.round(extras.reduce((s, e) => s + addOnGross(e), 0));
  return amt === whole || extras.some((e) => Math.round(addOnGross(e)) === amt) ? "direct" : "ota";
}

export type OtaSide = { bank: number; cash: number; payable: number; bal: number };
export type OtaSplit = { addOnNet: number; addOnGst: number; direct: OtaSide; ota: OtaSide };

// The two halves of a live OTA booking that has add-ons, or null when the
// booking is not OTA, has nothing added on, or is cancelled (a cancellation
// settles through refunds and waive-offs as one booking).
export function otaSplit(b: Booking): OtaSplit | null {
  if (b.source !== "OTA" || b.status === "Cancelled") return null;
  const extras = b.extras ?? [];
  const addOnNet = extras.reduce((s, e) => s + e.amount, 0);
  const addOnGst = extras.reduce((s, e) => s + (e.gst ?? 0), 0);
  const addOnTotal = addOnNet + addOnGst;
  if (addOnTotal < 1) return null;
  const dedTotal = (b.deductions ?? []).reduce((s, d) => s + d.amount + d.gst, 0);
  const payTds = tdsOfPayments(b.payments);
  // What the OTA owes: the booking less the add-ons, its deductions, and
  // anything already netted off the bill
  const otaPayable = Math.max(
    0,
    b.grandTotal - addOnTotal - dedTotal - creditNoteRedeemed(b) - (b.waiveOff?.totalGross ?? 0) - payTds
  );
  const direct = { bank: 0, cash: 0 };
  const ota = { bank: 0, cash: 0 };
  const take = (side: { bank: number; cash: number }, p: Payment) => {
    if ((p.mode || "").toLowerCase().includes("cash")) side.cash += p.amount;
    else side.bank += p.amount;
  };
  const pays = (b.payments ?? []).filter((p) => !isTdsPayment(p) && !isCreditNotePayment(p) && !isDepositAppliedPayment(p));
  pays.forEach((p) => take(otaReceiptSide(b, p) === "direct" ? direct : ota, p));
  // Legacy bookings carry an advance without itemised payments: OTA money
  if (pays.length === 0 && b.advance > 0) ota.bank = b.advance;
  // Money is money: the OTA pays out no more than it owes and the guest pays
  // no more than the add-ons cost, so whatever lands beyond one side's need
  // settles the other (a pay-at-hotel OTA guest pays the room at the desk).
  // Only what the other side still needs moves over.
  const shift = (from: { bank: number; cash: number }, to: { bank: number; cash: number }, amount: number) => {
    const fromBank = Math.min(amount, from.bank);
    const fromCash = amount - fromBank;
    from.bank -= fromBank;
    from.cash -= fromCash;
    to.bank += fromBank;
    to.cash += fromCash;
  };
  const otaOver = Math.min(ota.bank + ota.cash - otaPayable, addOnTotal - direct.bank - direct.cash);
  if (otaOver > 0) shift(ota, direct, otaOver);
  const directOver = Math.min(direct.bank + direct.cash - addOnTotal, otaPayable - ota.bank - ota.cash);
  if (directOver > 0) shift(direct, ota, directOver);
  return {
    addOnNet,
    addOnGst,
    direct: { ...direct, payable: addOnTotal, bal: Math.round(addOnTotal - direct.bank - direct.cash) },
    ota: { ...ota, payable: otaPayable, bal: Math.round(otaPayable - ota.bank - ota.cash) },
  };
}

// Charge-side view of a booking's add-ons alone, in the register's shape, so
// the Direct half of an OTA booking reports under the same columns.
export function extrasBreakdown(extras: Extra[]): BookingChargesBreakdown {
  const out: BookingChargesBreakdown = { roomNet: 0, mealNet: 0, creditNoteUsed: 0, other: 0, otherByItem: {}, gst5: 0, gst18: 0, gstOther: 0 };
  extras.forEach((e) => {
    const gst = e.gst ?? 0;
    const pct = e.amount > 0 && gst > 0 ? Math.round((gst / e.amount) * 100) : 0;
    const head = extraHead(e);
    if (head === "room") out.roomNet += e.amount;
    else if (head === "meal") out.mealNet += e.amount;
    else {
      const label = (e.name ?? "").trim() || "Add-on Charge";
      out.otherByItem[label] = (out.otherByItem[label] ?? 0) + e.amount;
      out.other += e.amount;
    }
    if (gst === 0) return;
    if (pct === 5) out.gst5 += gst;
    else if (pct === 18) out.gst18 += gst;
    else out.gstOther += gst;
  });
  return out;
}

// ─────── GROUP BOOKINGS ───────
export function isGroupBooking(b: { kind?: BookingKind }): boolean {
  return b.kind === "group";
}

// Security deposit applied to the bill at settlement. The money came in
// earlier as the deposit, so this is a settlement, not a fresh receipt.
export function isDepositAppliedPayment(p: Payment): boolean {
  return (p.mode || "").trim().toLowerCase() === DEPOSIT_MODE.toLowerCase();
}

export function depositReceived(b: Booking): number {
  return (b.deposit?.entries ?? []).reduce((s, e) => s + e.amount, 0);
}

export function depositApplied(b: Booking): number {
  return b.deposit?.settlement?.applied ?? 0;
}

export function depositRefunded(b: Booking): number {
  return b.deposit?.settlement?.refunded ?? 0;
}

// Deposit money the hotel is still holding: received, less what was applied
// to the bill and what went back to the guest.
export function depositHeld(b: Booking): number {
  return Math.round(depositReceived(b) - depositApplied(b) - depositRefunded(b));
}

// Deposit money the hotel kept: what came in less what went back. Before
// settlement this is the amount held; after it, the part applied to the bill.
export function depositRetained(b: Booking): number {
  return Math.round(depositReceived(b) - depositRefunded(b));
}

// TDS entries on a booking: the client withheld this and remitted it to the
// government, so it settles the bill without ever arriving as cash.
export function isTdsPayment(p: Payment): boolean {
  return (p.mode || "").trim().toLowerCase() === "tds";
}

export function tdsOfPayments(payments: Payment[] | undefined): number {
  return (payments ?? []).reduce((s, p) => s + (p.tds ?? 0) + (isTdsPayment(p) ? p.amount : 0), 0);
}

// Sum of payment amounts excluding TDS entries: the per-payment `tds` field
// is tracked beside the amount, not inside it, so only legacy mode-TDS rows
// need removing. Refunds are negative amounts and net off here.
export function cashOfPayments(payments: Payment[] | undefined): number {
  return (payments ?? []).filter((p) => !isTdsPayment(p)).reduce((s, p) => s + p.amount, 0);
}

// Cash and bank money actually received on a booking.
export function cashReceived(b: Booking): number {
  const { bank, cash } = paymentSplit(b);
  return bank + cash;
}

// Credit note redemptions on a booking, grouped by note code.
export function creditNoteRedemptions(b: Booking): { code: string; amount: number }[] {
  const byCode = new Map<string, number>();
  (b.payments ?? []).forEach((p) => {
    if (!isCreditNotePayment(p) || !p.creditNoteCode || p.amount <= 0) return;
    byCode.set(p.creditNoteCode, (byCode.get(p.creditNoteCode) ?? 0) + p.amount);
  });
  return [...byCode.entries()].map(([code, amount]) => ({ code, amount }));
}

// ─────── ROOM ALLOCATION ───────
function bookingOccupiesDate(b: Booking, date: string): boolean {
  return b.checkin <= date && date < b.checkout;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Physical rooms a booking holds on a given date. Bookings allocated per
// segment hold only that segment's rooms for its date range; legacy bookings
// (no per-segment allocation) hold all allocated rooms for the whole stay.
export function roomsHeldOnDate(b: Booking, date: string): string[] {
  if (!bookingOccupiesDate(b, date)) return [];
  const segsWithAlloc = (b.segments ?? []).filter((s) => Array.isArray(s.allocatedRooms));
  if (segsWithAlloc.length === 0) return b.allocatedRooms;
  const held = new Set<string>();
  segsWithAlloc.forEach((s) => {
    if (s.checkin <= date && date < s.checkout) {
      (s.allocatedRooms ?? []).forEach((r) => held.add(r));
    }
  });
  return [...held];
}

// Numeric-aware label comparison so V10 sorts after V9, not after V1.
export function compareRoomLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// Canonical display order for physical rooms: category blocks follow the
// room-master order, rooms within a block sort by label numerically.
export function sortRoomInventory<T extends { label: string; cat: string }>(
  inventory: T[],
  catOrder: { id: string }[]
): T[] {
  const idx = new Map(catOrder.map((c, i) => [c.id, i]));
  return [...inventory].sort((a, b) => {
    const ca = idx.get(a.cat) ?? catOrder.length;
    const cb = idx.get(b.cat) ?? catOrder.length;
    if (ca !== cb) return ca - cb;
    return compareRoomLabels(a.label, b.label);
  });
}

// Occupancy end for venue/bulk room blocks: a same-day block (dayout) holds
// its single date, i.e. occupies [checkin, checkin + 1 day) so it can't be
// double-booked for that night.
export function blockOccupancyEnd(checkin: string, checkout: string): string {
  if (checkout > checkin) return checkout;
  const d = new Date(checkin);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

// The venue block already holding `venueId` for any part of [checkin,
// checkout), ignoring the blocks in `ignoreIds` (a booking's own holds when
// it is re-saved). A same-day range is a dayout and holds that one date.
export function findVenueConflict(
  venueBlocks: VenueBlock[],
  venueId: string,
  checkin: string,
  checkout: string,
  ignoreIds: string[] = []
): VenueBlock | null {
  const end = blockOccupancyEnd(checkin, checkout);
  return (
    venueBlocks.find(
      (vb) =>
        !ignoreIds.includes(vb.id) &&
        vb.venueId === venueId &&
        vb.checkin < end &&
        checkin < blockOccupancyEnd(vb.checkin, vb.checkout)
    ) || null
  );
}

// Physical rooms a booking actually sleeps in on a given date: the rooms it
// holds, with any per-night reassignment (drag on the room chart) applied.
export function effectiveRoomsOnDate(b: Booking, date: string): string[] {
  return roomsHeldOnDate(b, date).map((roomId) => {
    const override = b.nightOverrides?.find((o) => o.date === date && o.fromRoomId === roomId);
    return override ? override.toRoomId : roomId;
  });
}

function nextDay(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function findAvailableRoomIds(
  category: string,
  checkin: string,
  checkout: string,
  bookings: Booking[],
  inventory: RoomInventoryItem[] = ROOM_INVENTORY,
  ignoreBookingId?: string,
  bulkBlocks: BulkRoomBlock[] = [],
  ignoreBlockId?: string
): string[] {
  const occupied = new Set<string>();
  // Resolve occupancy night by night so a booking that was dragged to another
  // room for some nights blocks the room it actually sleeps in, not the one it
  // was originally allocated.
  bookings
    .filter((b) => b.id !== ignoreBookingId)
    .filter((b) => b.status === "Tentative" || b.status === "Confirmed" || b.status === "Completed")
    .filter((b) => rangesOverlap(b.checkin, b.checkout, checkin, checkout))
    .forEach((b) => {
      const from = b.checkin > checkin ? b.checkin : checkin;
      const to = b.checkout < checkout ? b.checkout : checkout;
      for (let date = from; date < to; date = nextDay(date)) {
        effectiveRoomsOnDate(b, date).forEach((r) => occupied.add(r));
      }
    });
  bulkBlocks
    .filter((blk) => blk.id !== ignoreBlockId)
    .filter((blk) => rangesOverlap(blk.checkin, blockOccupancyEnd(blk.checkin, blk.checkout), checkin, checkout))
    .forEach((blk) => blk.rows.forEach((row) => row.roomIds.forEach((r) => occupied.add(r))));
  return inventory
    .filter((r) => r.cat === category && r.active && !occupied.has(r.id))
    .map((r) => r.id);
}

export type AssignmentResult =
  | { ok: true; rooms: string[]; perSegment: Record<string, string[]> }
  | { ok: false; missingCategoryName: string };

// Allocates physical rooms per segment against each segment's own date range,
// so a room needed only for part of the stay stays sellable for the rest.
// Prefers keeping the same physical room across segments of the same category
// so guests don't switch rooms unnecessarily.
//
// `existing` is the booking as currently saved, when re-allocating on an
// edit or a confirm. Its villas are kept, segment by segment, as long as
// every night still works: either the villa itself is free that night, or
// the guest was moved for that night (a chart drag or an upgrade) and the
// villa they were moved to is free. So an upgraded guest keeps their booked
// slot and their upgrade even after the vacated villa was resold, and a
// guest dragged for part of a stay keeps both villas. A villa is replaced
// only when a night genuinely cannot be honoured, and then the villa the
// guest actually sleeps in is offered first. Without `existing` the
// allocator picks the first free rooms.
export function tryAssignRooms(
  segments: BookingSegment[],
  _checkin: string,
  _checkout: string,
  bookings: Booking[],
  inventory: RoomInventoryItem[] = ROOM_INVENTORY,
  ignoreBookingId?: string,
  bulkBlocks: BulkRoomBlock[] = [],
  roomMaster: RoomMaster[] = ROOMS,
  existing?: Booking
): AssignmentResult {
  const union = new Set<string>();
  const perSegment: Record<string, string[]> = {};
  // Rooms this allocation has already claimed, with their date ranges, so
  // overlapping segments of the same booking don't double-book a room.
  const claimed: { checkin: string; checkout: string; roomId: string }[] = [];
  const usedByCat = new Map<string, string[]>();
  const keep = existing ? currentAllocation(existing) : {};
  const catOf = (roomId: string) => inventory.find((r) => r.id === roomId)?.cat;
  const freeOnNight = (roomId: string, date: string) => {
    const cat = catOf(roomId);
    return !!cat && findAvailableRoomIds(cat, date, nextDay(date), bookings, inventory, ignoreBookingId, bulkBlocks).includes(roomId);
  };
  // Can this booking go on holding `roomId` for every night of the segment,
  // given where the guest actually sleeps each night?
  const stillHonoured = (roomId: string, seg: BookingSegment) => {
    for (let d = seg.checkin; d < seg.checkout; d = nextDay(d)) {
      const moved = existing?.nightOverrides?.find((o) => o.date === d && o.fromRoomId === roomId);
      if (!freeOnNight(moved ? moved.toRoomId : roomId, d)) return false;
    }
    return true;
  };

  for (const seg of segments) {
    const segAssigned: string[] = [];
    const need = new Map<string, number>();
    seg.rooms
      .filter((r) => r.roomId)
      .forEach((r) => {
        need.set(r.roomId, Math.max(need.get(r.roomId) || 0, r.numRooms));
      });
    for (const [cat, count] of need.entries()) {
      if (count <= 0) continue;
      const notClaimed = (id: string) =>
        !claimed.some((c) => c.roomId === id && rangesOverlap(c.checkin, c.checkout, seg.checkin, seg.checkout));
      const take = (id: string) => {
        segAssigned.push(id);
        union.add(id);
        claimed.push({ checkin: seg.checkin, checkout: seg.checkout, roomId: id });
        const used = usedByCat.get(cat) ?? [];
        if (!used.includes(id)) usedByCat.set(cat, [...used, id]);
      };
      // 1. Villas of this category the booking already holds for this
      //    segment, kept whenever every night still works out.
      const storedSeg = existing?.segments?.find((s) => s.id === seg.id);
      const stored = storedSeg
        ? (Array.isArray(storedSeg.allocatedRooms) ? storedSeg.allocatedRooms : existing?.allocatedRooms ?? [])
        : [];
      let remaining = count;
      for (const id of stored) {
        if (remaining <= 0) break;
        if (catOf(id) !== cat || !notClaimed(id) || segAssigned.includes(id)) continue;
        // A guest who is in-house, or whose villas Sales has locked, keeps
        // their villa no matter what.
        if (existing?.checkedIn || existing?.roomLock || stillHonoured(id, seg)) {
          take(id);
          remaining--;
        }
      }
      if (remaining <= 0) continue;
      // 2. Otherwise pick free villas: the one the guest sleeps in first,
      //    then one an earlier segment of the same category used (so guests
      //    don't switch villas mid-stay), then inventory order.
      const free = findAvailableRoomIds(cat, seg.checkin, seg.checkout, bookings, inventory, ignoreBookingId, bulkBlocks)
        .filter((id) => notClaimed(id) && !segAssigned.includes(id));
      if (free.length < remaining) {
        const room = roomMaster.find((r) => r.id === cat);
        return { ok: false, missingCategoryName: room?.name ?? cat };
      }
      const previouslyUsed = usedByCat.get(cat) ?? [];
      const held = keep[seg.id] ?? [];
      const rank = (id: string) => {
        const i = held.indexOf(id);
        if (i >= 0) return i;
        return held.length + (previouslyUsed.includes(id) ? 0 : 1);
      };
      [...free].sort((a, b) => rank(a) - rank(b)).slice(0, remaining).forEach(take);
    }
    perSegment[seg.id] = segAssigned;
  }
  return { ok: true, rooms: [...union], perSegment };
}

// The villas a booking currently occupies, keyed by segment id, in the shape
// tryAssignRooms takes as `keep`. Where a room-chart drag moved the guest,
// the villa they actually sleep in ranks ahead of the one originally
// allocated, weighted by how many nights of the segment it covers, so a
// full-stay move is kept as the new home and a one-night move keeps the
// original villa with the move note still valid. Legacy bookings without
// per-segment allocation offer their whole-stay rooms to every segment.
export function currentAllocation(b: Booking): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  (b.segments ?? []).forEach((s) => {
    const stored = Array.isArray(s.allocatedRooms) ? s.allocatedRooms : b.allocatedRooms;
    const nights = new Map<string, number>();
    stored.forEach((r) => nights.set(r, 0));
    for (let d = s.checkin; d < s.checkout; d = nextDay(d)) {
      effectiveRoomsOnDate(b, d).forEach((r) => nights.set(r, (nights.get(r) ?? 0) + 1));
    }
    out[s.id] = [...nights.entries()]
      .sort((x, y) => y[1] - x[1] || (stored.includes(y[0]) ? 1 : 0) - (stored.includes(x[0]) ? 1 : 0))
      .map(([r]) => r);
  });
  return out;
}

// Per-night moves (chart drags) that still make sense after an allocation
// change: the night must fall inside the stay and the room moved from must
// still be one the booking holds. Anything else is a phantom that would paint
// a villa the guest is not in.
export function pruneNightOverrides(
  overrides: RoomNightOverride[] | undefined,
  checkin: string,
  checkout: string,
  allocatedRooms: string[]
): RoomNightOverride[] {
  return (overrides ?? []).filter(
    (o) => o.date >= checkin && o.date < checkout && allocatedRooms.includes(o.fromRoomId)
  );
}

// Marker so the helper above doesn't get treated as dead code by tree shakers
export const __occupiesDate = bookingOccupiesDate;
