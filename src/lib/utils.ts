import type {
  Booking,
  BookingStatus,
  BulkRoomBlock,
  DiscountCaps,
  GstSettings,
  PricingRow,
  Role,
  RoomInventoryItem,
  RoomMaster,
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
  const gstRate = tariff > gstSettings.threshold ? gstSettings.aboveRate : gstSettings.belowRate;
  const roomCharges = tariff * nights * numRooms;
  const discountAmt = roomCharges * (discountPct / 100);
  const netCharges = roomCharges - discountAmt;
  const gstAmt = netCharges * (gstRate / 100);
  const totalAmt = netCharges + gstAmt;
  return {
    rowType,
    roomId,
    roomName: room?.name ?? "",
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

// ─────── ROOM ALLOCATION ───────
function bookingOccupiesDate(b: Booking, date: string): boolean {
  return b.checkin <= date && date < b.checkout;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
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
    .forEach((b) => b.allocatedRooms.forEach((r) => occupied.add(r)));
  bulkBlocks
    .filter((blk) => blk.id !== ignoreBlockId)
    .filter((blk) => rangesOverlap(blk.checkin, blk.checkout, checkin, checkout))
    .forEach((blk) => blk.rows.forEach((row) => row.roomIds.forEach((r) => occupied.add(r))));
  return inventory
    .filter((r) => r.cat === category && r.active && !occupied.has(r.id))
    .map((r) => r.id);
}

export type AssignmentResult =
  | { ok: true; rooms: string[] }
  | { ok: false; missingCategoryName: string };

export function tryAssignRooms(
  pricingRows: PricingRow[],
  checkin: string,
  checkout: string,
  bookings: Booking[],
  inventory: RoomInventoryItem[] = ROOM_INVENTORY,
  ignoreBookingId?: string,
  bulkBlocks: BulkRoomBlock[] = [],
  roomMaster: RoomMaster[] = ROOMS
): AssignmentResult {
  const need = new Map<string, number>();
  pricingRows
    .filter((r) => r.roomId)
    .forEach((r) => {
      const prev = need.get(r.roomId) || 0;
      need.set(r.roomId, Math.max(prev, r.numRooms));
    });
  const assigned: string[] = [];
  for (const [cat, count] of need.entries()) {
    if (count <= 0) continue;
    const free = findAvailableRoomIds(cat, checkin, checkout, bookings, inventory, ignoreBookingId, bulkBlocks);
    if (free.length < count) {
      const room = roomMaster.find((r) => r.id === cat);
      return { ok: false, missingCategoryName: room?.name ?? cat };
    }
    assigned.push(...free.slice(0, count));
  }
  return { ok: true, rooms: assigned };
}

// Marker so the helper above doesn't get treated as dead code by tree shakers
export const __occupiesDate = bookingOccupiesDate;
