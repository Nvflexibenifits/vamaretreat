import type {
  B2BBooking,
  Booking,
  BookingSegment,
  BookingStatus,
  BulkRoomBlock,
  ChargeHead,
  DiscountCaps,
  Extra,
  GstSettings,
  PricingRow,
  Role,
  RoomInventoryItem,
  RoomMaster,
  SegmentRoom,
} from "@/types";
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
export function extraHead(e: Extra): ChargeHead {
  if (e.head) return e.head;
  const name = (e.name ?? "").trim().toLowerCase();
  const byCategory = ADD_ON_CATEGORY_HEADS[name];
  if (byCategory) return byCategory;
  if (name.startsWith("room upgrade")) return "room";
  return "other";
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
export function tryAssignRooms(
  segments: BookingSegment[],
  _checkin: string,
  _checkout: string,
  bookings: Booking[],
  inventory: RoomInventoryItem[] = ROOM_INVENTORY,
  ignoreBookingId?: string,
  bulkBlocks: BulkRoomBlock[] = [],
  roomMaster: RoomMaster[] = ROOMS
): AssignmentResult {
  const union = new Set<string>();
  const perSegment: Record<string, string[]> = {};
  // Rooms this allocation has already claimed, with their date ranges, so
  // overlapping segments of the same booking don't double-book a room.
  const claimed: { checkin: string; checkout: string; roomId: string }[] = [];
  const usedByCat = new Map<string, string[]>();

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
      const free = findAvailableRoomIds(cat, seg.checkin, seg.checkout, bookings, inventory, ignoreBookingId, bulkBlocks)
        .filter((id) => !claimed.some((c) => c.roomId === id && rangesOverlap(c.checkin, c.checkout, seg.checkin, seg.checkout)));
      if (free.length < count) {
        const room = roomMaster.find((r) => r.id === cat);
        return { ok: false, missingCategoryName: room?.name ?? cat };
      }
      const previouslyUsed = usedByCat.get(cat) ?? [];
      const ordered = [...free].sort(
        (a, b) => (previouslyUsed.includes(b) ? 1 : 0) - (previouslyUsed.includes(a) ? 1 : 0)
      );
      ordered.slice(0, count).forEach((id) => {
        segAssigned.push(id);
        union.add(id);
        claimed.push({ checkin: seg.checkin, checkout: seg.checkout, roomId: id });
        if (!previouslyUsed.includes(id)) usedByCat.set(cat, [...previouslyUsed, id]);
      });
    }
    perSegment[seg.id] = segAssigned;
  }
  return { ok: true, rooms: [...union], perSegment };
}

// Marker so the helper above doesn't get treated as dead code by tree shakers
export const __occupiesDate = bookingOccupiesDate;
