import type {
  Booking,
  BookingSegment,
  BookingStatus,
  BulkRoomBlock,
  DiscountCaps,
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
  rowType: PricingRow["rowType"],
  role: Role,
  caps: DiscountCaps
): number {
  // Per-day-type hard caps regardless of role.
  const rowCap =
    rowType === "sat" ? 10
    : rowType === "fri" ? 15
    : rowType === "fri-sat" ? 15   // legacy rows
    : 24;
  return Math.min(rowCap, maxDiscountForRole(role, caps));
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

export type BookingChargesBreakdown = {
  roomNet: number;
  mealNet: number;
  other: number;
  gst5: number;
  gst18: number;
  gstOther: number;
};

// Charge-side view of a booking as the Revenue Register reports it: net
// room/meal/other excluding GST, with GST split by rate. Refund cancellations
// contribute nothing here — their revenue leaves with the refund and only the
// cancellation charge (handled by the caller) is kept. Credit-note
// cancellations keep full revenue: no money leaves, the stay obligation
// remains. The dashboard Revenue card sums roomNet + mealNet + other so it
// always matches the register's Total Charges.
export function bookingChargesBreakdown(b: Booking): BookingChargesBreakdown {
  const isRefundCancel =
    b.status === "Cancelled" && b.cancellationDetails?.resolution === "refund";
  if (isRefundCancel) {
    return { roomNet: 0, mealNet: 0, other: 0, gst5: 0, gst18: 0, gstOther: 0 };
  }

  const pricingRows = getBookingPricingRows(b);
  const roomNet = pricingRows.reduce((s, r) => s + r.netCharges, 0);
  let gst5 = 0;
  let gst18 = 0;
  pricingRows.forEach((r) => {
    if (r.gstAmt <= 0) return;
    if (r.gstRate === 5) gst5 += r.gstAmt;
    else gst18 += r.gstAmt;
  });
  const mealNet = b.mealTotal + b.petTotal + (b.driverMealTotal ?? 0);
  gst18 += b.mealGst + b.petGst + (b.driverMealGst ?? 0);
  // Itemized add-ons: net amount in Other, GST bucketed by its actual rate —
  // 5% and 18% join their columns, anything else goes to GST Other.
  const extrasList = b.extras ?? [];
  const extrasNet = extrasList.reduce((s, e) => s + e.amount, 0);
  let extrasGst = 0;
  let gstOther = 0;
  extrasList.forEach((e) => {
    const gst = e.gst ?? 0;
    if (gst <= 0) return;
    const pct = e.amount > 0 ? Math.round((gst / e.amount) * 100) : 0;
    if (pct === 5) gst5 += gst;
    else if (pct === 18) gst18 += gst;
    else gstOther += gst;
    extrasGst += gst;
  });
  // Legacy bookings rolled add-ons into grandTotal without itemizing;
  // whatever the itemized extras don't explain stays as a gross remainder.
  const other =
    extrasNet +
    Math.max(0, b.grandTotal - b.totalRoomCharges - b.totalMealCharges - extrasNet - extrasGst);

  return { roomNet, mealNet, other, gst5, gst18, gstOther };
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
  bookings
    .filter((b) => b.id !== ignoreBookingId)
    .filter((b) => b.status === "Tentative" || b.status === "Confirmed" || b.status === "Completed")
    .filter((b) => rangesOverlap(b.checkin, b.checkout, checkin, checkout))
    .forEach((b) => {
      const segsWithAlloc = (b.segments ?? []).filter((s) => Array.isArray(s.allocatedRooms));
      if (segsWithAlloc.length === 0) {
        b.allocatedRooms.forEach((r) => occupied.add(r));
      } else {
        segsWithAlloc
          .filter((s) => rangesOverlap(s.checkin, s.checkout, checkin, checkout))
          .forEach((s) => (s.allocatedRooms ?? []).forEach((r) => occupied.add(r)));
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
