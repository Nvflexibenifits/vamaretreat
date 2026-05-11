import type { Booking, PricingRow, RoomInventoryItem, RoomMaster } from "@/types";

// ─────────── ROOM TYPE MASTER (pricing source of truth) ───────────
export const ROOMS: RoomMaster[] = [
  { id: "TENT", name: "Tent", wd: 3800, wknd: 4500, gst: 5 },
  { id: "CPL", name: "Couple Room", wd: 6500, wknd: 7500, gst: 5 },
  { id: "FM", name: "Family Room", wd: 8000, wknd: 9000, gst: 18 },
  { id: "1BHK", name: "1BHK Villa", wd: 8800, wknd: 9800, gst: 18 },
  { id: "1BHK-GV", name: "1BHK Garden View", wd: 10500, wknd: 11500, gst: 18 },
  { id: "2BHK", name: "2BHK Villa", wd: 12000, wknd: 13000, gst: 18 },
  { id: "2BHK-GV", name: "2BHK Garden View", wd: 13200, wknd: 14200, gst: 18 },
  { id: "PV", name: "1BHK Pool Villa", wd: 20000, wknd: 25800, gst: 18 },
];

// ─────────── PHYSICAL ROOMS (51 total per doc §1) ───────────
function inventoryFor(prefix: string, type: string, cat: string, count: number): RoomInventoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    label: `${prefix}${i + 1}`,
    type,
    cat,
  }));
}

export const ROOM_INVENTORY: RoomInventoryItem[] = [
  { id: "PV1", label: "PV1", type: "Pool Villa", cat: "PV" },
  ...inventoryFor("V", "1BHK Villa", "1BHK", 12),
  ...inventoryFor("GV", "1BHK Garden View", "1BHK-GV", 8),
  ...inventoryFor("2B", "2BHK Villa", "2BHK", 5),
  ...inventoryFor("2GV", "2BHK Garden View", "2BHK-GV", 5),
  ...inventoryFor("FM", "Family Room", "FM", 4),
  ...inventoryFor("CPL", "Couple Room", "CPL", 10),
  ...inventoryFor("T", "Tent", "TENT", 6),
];

// ─────────── HELPERS used by seed builder ───────────
function splitNights(checkin: string, checkout: string): { weekday: number; weekend: number } {
  let weekday = 0;
  let weekend = 0;
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

function mkPricingRow(
  rowType: PricingRow["rowType"],
  roomId: string,
  nights: number,
  numRooms: number,
  discountPct: number
): PricingRow {
  const room = ROOMS.find((r) => r.id === roomId)!;
  const tariff = rowType === "fri-sat" ? room.wknd : room.wd;
  const roomCharges = tariff * nights * numRooms;
  const discountAmt = roomCharges * (discountPct / 100);
  const netCharges = roomCharges - discountAmt;
  const gstAmt = netCharges * (room.gst / 100);
  const totalAmt = netCharges + gstAmt;
  return {
    rowType,
    roomId,
    roomName: room.name,
    tariff,
    nights,
    numRooms,
    roomCharges,
    discountPct,
    discountAmt,
    netCharges,
    gstRate: room.gst,
    gstAmt,
    totalAmt,
  };
}

function pricingRowsFor(
  checkin: string,
  checkout: string,
  roomId: string,
  numRooms: number,
  discountPct: number
): PricingRow[] {
  const { weekday, weekend } = splitNights(checkin, checkout);
  const rows: PricingRow[] = [];
  if (weekday > 0) rows.push(mkPricingRow("sun-thu", roomId, weekday, numRooms, discountPct));
  if (weekend > 0) rows.push(mkPricingRow("fri-sat", roomId, weekend, numRooms, discountPct));
  return rows;
}

function totals(rows: PricingRow[], mealTotal: number, mealGst: number, petTotal: number, petGst: number) {
  const totalRoomCharges = rows.reduce((s, r) => s + r.totalAmt, 0);
  const totalMealCharges = mealTotal + mealGst + petTotal + petGst;
  const grandTotal = totalRoomCharges + totalMealCharges;
  return { totalRoomCharges, totalMealCharges, grandTotal };
}

// ─────────── SEED BOOKINGS (rebuilt onto new schema) ───────────
type SeedSpec = {
  id: string;
  guest: string;
  mobile: string;
  email?: string;
  source: string;
  notes?: string;
  rex: string;

  checkin: string;
  checkout: string;

  adults: number;
  kidsAbove10?: number;
  kids6to10?: number;
  kids2to6?: number;
  infantsBelow2?: number;
  seniors?: number;
  pets?: number;

  // pricing
  roomId: string;
  numRooms: number;
  discountPct: number;

  mealOn: boolean;

  status: Booking["status"];
  allocatedRooms?: string[];
  advance: number;
  payments: Booking["payments"];
  extras?: Booking["extras"];
  lostReason?: string;
  lostNotes?: string;
};

function buildBooking(s: SeedSpec): Booking {
  const nights = (() => {
    const ms = new Date(s.checkout).getTime() - new Date(s.checkin).getTime();
    return Math.round(ms / 86400000);
  })();
  const rows = pricingRowsFor(s.checkin, s.checkout, s.roomId, s.numRooms, s.discountPct);
  const adultsForMeal = s.adults;
  const mealTotal = s.mealOn ? 2100 * nights * adultsForMeal : 0;
  const mealGst = mealTotal * 0.18;
  const petsCount = s.pets ?? 0;
  const petTotal = petsCount > 0 ? 1200 * nights * petsCount : 0;
  const petGst = petTotal * 0.18;
  const t = totals(rows, mealTotal, mealGst, petTotal, petGst);
  const balance = Math.max(0, t.grandTotal - s.advance);
  return {
    id: s.id,
    guest: s.guest,
    mobile: s.mobile,
    email: s.email ?? "",
    source: s.source,
    notes: s.notes ?? "",
    rex: s.rex,

    checkin: s.checkin,
    checkout: s.checkout,
    nights,

    adults: s.adults,
    kidsAbove10: s.kidsAbove10 ?? 0,
    kids6to10: s.kids6to10 ?? 0,
    kids2to6: s.kids2to6 ?? 0,
    infantsBelow2: s.infantsBelow2 ?? 0,
    seniors: s.seniors ?? 0,
    pets: petsCount,

    pricingRows: rows,

    mealOn: s.mealOn,
    mealTotal,
    mealGst,
    petTotal,
    petGst,

    totalRoomCharges: t.totalRoomCharges,
    totalMealCharges: t.totalMealCharges,
    grandTotal: t.grandTotal,

    advance: s.advance,
    balance: s.status === "Lost" || s.status === "Cancelled" ? 0 : balance,

    status: s.status,
    allocatedRooms: s.allocatedRooms ?? [],

    payments: s.payments,
    extras: s.extras ?? [],
    lostReason: s.lostReason,
    lostNotes: s.lostNotes,
  };
}

const SEED_SPECS: SeedSpec[] = [
  {
    id: "VR-2026-001",
    guest: "Ms Shivangini",
    mobile: "8469938018",
    source: "WhatsApp",
    notes: "1 pet",
    rex: "Anagha",
    checkin: "2026-05-01",
    checkout: "2026-05-02",
    adults: 4,
    pets: 1,
    roomId: "PV",
    numRooms: 1,
    discountPct: 0,
    mealOn: true,
    status: "Confirmed",
    allocatedRooms: ["PV1"],
    advance: 10000,
    payments: [
      { date: "2026-04-28", time: "11:45am", type: "Advance", amount: 10000, mode: "UPI / QR", by: "Anagha" },
    ],
  },
  {
    id: "VR-2026-002",
    guest: "Ankit Gupta",
    mobile: "9886375015",
    email: "ankit@gmail.com",
    source: "Referral",
    rex: "Karthik",
    checkin: "2026-05-01",
    checkout: "2026-05-03",
    adults: 2,
    kidsAbove10: 1,
    roomId: "1BHK-GV",
    numRooms: 1,
    discountPct: 10,
    mealOn: false,
    status: "Confirmed",
    allocatedRooms: ["GV1"],
    advance: 22302,
    payments: [
      { date: "2026-04-29", time: "03:20pm", type: "Full Payment", amount: 22302, mode: "Bank Transfer", by: "Karthik" },
    ],
  },
  {
    id: "VR-2026-003",
    guest: "Meera Iyer",
    mobile: "9945888221",
    source: "WhatsApp",
    notes: "Anniversary",
    rex: "Karthik",
    checkin: "2026-05-08",
    checkout: "2026-05-09",
    adults: 2,
    roomId: "CPL",
    numRooms: 1,
    discountPct: 0,
    mealOn: true,
    status: "Enquiry",
    advance: 0,
    payments: [],
  },
  {
    id: "VR-2026-004",
    guest: "Rajesh Sharma",
    mobile: "7799881122",
    source: "Phone Call",
    rex: "Anagha",
    checkin: "2026-04-28",
    checkout: "2026-04-30",
    adults: 3,
    kidsAbove10: 1,
    kids6to10: 1,
    roomId: "2BHK",
    numRooms: 1,
    discountPct: 15,
    mealOn: true,
    status: "Completed",
    allocatedRooms: ["2B1"],
    advance: 36462,
    payments: [
      { date: "2026-04-25", time: "10:30am", type: "Advance", amount: 15000, mode: "Cash", by: "Anagha" },
      { date: "2026-04-28", time: "02:15pm", type: "Balance", amount: 21462, mode: "UPI / QR", by: "Anagha" },
    ],
    extras: [{ name: "BBQ Dinner", amount: 2000, date: "2026-04-29", by: "Anagha" }],
  },
  {
    id: "VR-2026-005",
    guest: "Sunita Rao",
    mobile: "9812345678",
    source: "WhatsApp",
    rex: "Karthik",
    checkin: "2026-04-22",
    checkout: "2026-04-23",
    adults: 4,
    roomId: "1BHK",
    numRooms: 2,
    discountPct: 5,
    mealOn: true,
    status: "Lost",
    advance: 0,
    payments: [],
    lostReason: "Price too high",
    lostNotes: "Said competitor offers similar at lower rate",
  },
  {
    id: "VR-2026-006",
    guest: "Deepak Bhat",
    mobile: "9933221100",
    email: "deepak@co.in",
    source: "WhatsApp",
    notes: "Honeymoon",
    rex: "Anagha",
    checkin: "2026-05-12",
    checkout: "2026-05-14",
    adults: 2,
    roomId: "PV",
    numRooms: 1,
    discountPct: 0,
    mealOn: true,
    status: "Enquiry",
    advance: 0,
    payments: [],
  },
  {
    id: "VR-2026-007",
    guest: "Arun Patel",
    mobile: "9876543210",
    source: "Phone Call",
    rex: "Karthik",
    checkin: "2026-05-10",
    checkout: "2026-05-11",
    adults: 2,
    kids6to10: 1,
    kids2to6: 1,
    roomId: "FM",
    numRooms: 1,
    discountPct: 0,
    mealOn: true,
    status: "Confirmed",
    allocatedRooms: ["FM1"],
    advance: 5000,
    payments: [
      { date: "2026-05-04", time: "09:00am", type: "Advance", amount: 5000, mode: "UPI / QR", by: "Karthik" },
    ],
  },
  {
    id: "VR-2026-008",
    guest: "Kavya Nair",
    mobile: "8811223344",
    source: "WhatsApp",
    rex: "Anagha",
    checkin: "2026-04-15",
    checkout: "2026-04-16",
    adults: 2,
    roomId: "CPL",
    numRooms: 1,
    discountPct: 0,
    mealOn: false,
    status: "Completed",
    allocatedRooms: ["CPL2"],
    advance: 6825,
    payments: [
      { date: "2026-04-13", time: "11:00am", type: "Full Payment", amount: 6825, mode: "Bank Transfer", by: "Anagha" },
    ],
  },
  {
    id: "VR-2026-009",
    guest: "Rohit Desai",
    mobile: "9900112233",
    source: "Referral",
    rex: "Karthik",
    checkin: "2026-04-18",
    checkout: "2026-04-19",
    adults: 3,
    roomId: "1BHK",
    numRooms: 1,
    discountPct: 0,
    mealOn: true,
    status: "Lost",
    advance: 0,
    payments: [],
    lostReason: "Dates not available",
  },
];

export const SEED_BOOKINGS: Booking[] = SEED_SPECS.map(buildBooking);

// ─────────── Other masters ───────────
export const USERS = [
  { name: "Karthik", role: "Sales REX", email: "karthik@vamaretreats.com", color: "#172f24" },
  { name: "Anagha", role: "Sales REX", email: "anagha@vamaretreats.com", color: "#5b21b6" },
  { name: "Priya", role: "Manager", email: "priya@vamaretreats.com", color: "#c9873a" },
  { name: "Rahul", role: "Room Allocator", email: "rahul@vamaretreats.com", color: "#1a4fd6" },
];

export const FORM_FIELDS = [
  { name: "Guest Name", required: true },
  { name: "Mobile Number", required: true },
  { name: "Check-in / Check-out Dates", required: true },
  { name: "Guest Count by Age Group", required: true },
  { name: "Room Selection", required: true },
  { name: "Enquiry Source", required: true },
  { name: "Meal & Activity Package", required: false },
  { name: "Discount", required: false },
  { name: "Special Request / Notes", required: false },
];
