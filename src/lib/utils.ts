import type { Booking, BookingStatus, PricingRow, Role } from "@/types";
import { ROOM_INVENTORY, ROOMS } from "@/lib/data";

export const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

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

export function statusBadgeDot(s: BookingStatus): string {
  const dots: Record<BookingStatus, string> = {
    Enquiry: "○",
    Tentative: "◐",
    Confirmed: "●",
    Completed: "✓",
    Lost: "✕",
    Cancelled: "⊘",
  };
  return dots[s];
}

export function maxDiscountForRole(role: Role): number {
  if (role === "Admin") return 100;
  if (role === "Manager") return 25;
  return 20; // Sales REX caps at 20% (weekday); per-row Fri-Sat cap further restricts to 15%
}

export function maxDiscountForRowAndRole(rowType: PricingRow["rowType"], role: Role): number {
  const rowCap = rowType === "fri-sat" ? 15 : 20;
  return Math.min(rowCap, maxDiscountForRole(role));
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
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─────── PRICING / ROW HELPERS ───────
export function splitNightsByType(checkin: string, checkout: string): { weekday: number; weekend: number } {
  let weekday = 0;
  let weekend = 0;
  if (!checkin || !checkout || checkout <= checkin) return { weekday, weekend };
  const cur = new Date(checkin);
  const end = new Date(checkout);
  while (cur < end) {
    const d = cur.getDay();
    if (d === 5 || d === 6) weekend++;
    else weekday++;
    cur.setDate(cur.getDate() + 1);
  }
  return { weekday, weekend };
}

export function calcPricingRow(
  rowType: PricingRow["rowType"],
  roomId: string,
  tariff: number,
  nights: number,
  numRooms: number,
  discountPct: number
): PricingRow {
  const room = ROOMS.find((r) => r.id === roomId);
  const gst = room?.gst ?? 0;
  const roomCharges = tariff * nights * numRooms;
  const discountAmt = roomCharges * (discountPct / 100);
  const netCharges = roomCharges - discountAmt;
  const gstAmt = netCharges * (gst / 100);
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
    gstRate: gst,
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
  ignoreBookingId?: string
): string[] {
  const occupied = new Set<string>();
  bookings
    .filter((b) => b.id !== ignoreBookingId)
    .filter((b) => b.status === "Tentative" || b.status === "Confirmed" || b.status === "Completed")
    .filter((b) => rangesOverlap(b.checkin, b.checkout, checkin, checkout))
    .forEach((b) => b.allocatedRooms.forEach((r) => occupied.add(r)));
  return ROOM_INVENTORY.filter((r) => r.cat === category && !occupied.has(r.id)).map((r) => r.id);
}

export type AssignmentResult =
  | { ok: true; rooms: string[] }
  | { ok: false; missingCategoryName: string };

export function tryAssignRooms(
  pricingRows: PricingRow[],
  checkin: string,
  checkout: string,
  bookings: Booking[],
  ignoreBookingId?: string
): AssignmentResult {
  // Per category, take max numRooms across rows (a guest holds those rooms for the full stay)
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
    const free = findAvailableRoomIds(cat, checkin, checkout, bookings, ignoreBookingId);
    if (free.length < count) {
      const room = ROOMS.find((r) => r.id === cat);
      return { ok: false, missingCategoryName: room?.name ?? cat };
    }
    assigned.push(...free.slice(0, count));
  }
  return { ok: true, rooms: assigned };
}

// Marker so the helper above doesn't get treated as dead code by tree shakers
export const __occupiesDate = bookingOccupiesDate;
