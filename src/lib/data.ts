import type {
  Booking,
  BookingSegment,
  BulkRoomBlock,
  CancellationPolicy,
  CreditNoteSettings,
  DiscountCaps,
  GstSettings,
  PackageRates,
  PricingRow,
  RoomInventoryItem,
  RoomMaster,
  SegmentRoom,
  SpecialDay,
  User,
  Venue,
  VenueBlock,
} from "@/types";

// ─────────── ROOM TYPE MASTER (pricing source of truth) ───────────
// Room Tariff FY 2025-26 w.e.f. 22.09.25. GST is computed dynamically via
// GstSettings (threshold 7500: below=5%, above=18%) — not stored per room.
export const ROOMS: RoomMaster[] = [
  { id: "TENT",    name: "Tent",                                price:  3800, weekdayDiscount: 20, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
  { id: "CPL",     name: "Couple Room",                         price:  6200, weekdayDiscount: 20, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
  { id: "FM",      name: "Family Room",                         price:  7600, weekdayDiscount: 20, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
  { id: "1BHK",    name: "1 BHK Villa",                         price:  8300, weekdayDiscount: 18, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
  { id: "1BHK-GV", name: "1 BHK Garden Villa (Ideal for Pets)", price: 10000, weekdayDiscount: 16, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
  { id: "2BHK",    name: "2 BHK Villa",                         price: 11500, weekdayDiscount: 16, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
  { id: "2BHK-GV", name: "2 BHK Garden Villa (Ideal for Pets)", price: 12500, weekdayDiscount: 15, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
  { id: "3BHK-GV", name: "3 BHK Garden Villa",                  price: 16000, weekdayDiscount: 15, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
  { id: "PV",      name: "1 BHK Pool Villa",                    price: 24500, weekdayDiscount: 20, fridayDiscount: 15, weekendDiscount: 10, specialDayDiscount: 0 },
];

// ─────────── PHYSICAL ROOMS (51 total per doc §1) ───────────
function inventoryFor(prefix: string, type: string, cat: string, count: number): RoomInventoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    label: `${prefix}${i + 1}`,
    type,
    cat,
    active: true,
  }));
}

export const SEED_ROOM_INVENTORY: RoomInventoryItem[] = [
  { id: "PV1", label: "PV1", type: "1 BHK Pool Villa", cat: "PV", active: true },
  ...inventoryFor("V",   "1 BHK Villa",                         "1BHK",    12),
  ...inventoryFor("GV",  "1 BHK Garden Villa (Ideal for Pets)", "1BHK-GV",  8),
  ...inventoryFor("2B",  "2 BHK Villa",                         "2BHK",     5),
  ...inventoryFor("2GV", "2 BHK Garden Villa (Ideal for Pets)", "2BHK-GV",  5),
  ...inventoryFor("3GV", "3 BHK Garden Villa",                  "3BHK-GV",  3),
  ...inventoryFor("FM",  "Family Room",                         "FM",        4),
  ...inventoryFor("CPL", "Couple Room",                         "CPL",      10),
  ...inventoryFor("T",   "Tent",                                "TENT",      6),
];

// Backwards-compatible alias so existing imports keep working
export const ROOM_INVENTORY = SEED_ROOM_INVENTORY;

// ─────────── HELPERS used by seed builder ───────────
function splitNights(checkin: string, checkout: string): { weekday: number; friday: number; saturday: number } {
  let weekday = 0;
  let friday = 0;
  let saturday = 0;
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

function mkPricingRow(
  rowType: PricingRow["rowType"],
  roomId: string,
  nights: number,
  numRooms: number,
  discountPct: number
): PricingRow {
  const room = ROOMS.find((r) => r.id === roomId)!;
  const tariff = room.price;
  const dayDiscount =
    rowType === "sat" ? room.weekendDiscount
    : rowType === "fri" ? room.fridayDiscount
    : room.weekdayDiscount;
  const effectiveDisc = Math.max(discountPct, dayDiscount);
  const roomCharges = tariff * nights * numRooms;
  const discountAmt = roomCharges * (effectiveDisc / 100);
  const netCharges = roomCharges - discountAmt;
  const gstRate = tariff > 7500 ? 18 : 5;
  const gstAmt = netCharges * (gstRate / 100);
  const totalAmt = netCharges + gstAmt;
  return {
    rowType,
    roomId,
    roomName: room.name,
    checkin: "",
    checkout: "",
    tariff,
    nights,
    numRooms,
    roomCharges,
    discountPct: effectiveDisc,
    discountAmt,
    netCharges,
    gstRate,
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
  const { weekday, friday, saturday } = splitNights(checkin, checkout);
  const rows: PricingRow[] = [];
  if (weekday > 0)  rows.push(mkPricingRow("sun-thu", roomId, weekday,  numRooms, discountPct));
  if (friday > 0)   rows.push(mkPricingRow("fri",     roomId, friday,   numRooms, discountPct));
  if (saturday > 0) rows.push(mkPricingRow("sat",     roomId, saturday, numRooms, discountPct));
  return rows;
}

let _segCounter = 0;
function sid() { return `seg-${++_segCounter}`; }

function buildSegment(
  checkin: string,
  checkout: string,
  roomId: string,
  numRooms: number,
  discountPct: number
): BookingSegment {
  const rows = pricingRowsFor(checkin, checkout, roomId, numRooms, discountPct);
  const room = ROOMS.find((r) => r.id === roomId)!;
  const segRoom: SegmentRoom = {
    id: sid(),
    roomId,
    roomName: room.name,
    numRooms,
    discountPct,
    pricingRows: rows,
    netCharges: rows.reduce((s, r) => s + r.netCharges, 0),
    gstAmt: rows.reduce((s, r) => s + r.gstAmt, 0),
    totalAmt: rows.reduce((s, r) => s + r.totalAmt, 0),
  };
  return {
    id: sid(),
    checkin,
    checkout,
    rooms: [segRoom],
    segmentTotal: segRoom.totalAmt,
    adults: 2,
    seniors: 0,
    kidsAbove10: 0,
    kids6to10: 0,
    kids2to6: 0,
    infantsBelow2: 0,
    pets: 0,
    mealOn: false,
    drivers: 0,
    driverMealOn: false,
    mealTotal: 0,
    mealGst: 0,
    mealWithGst: 0,
  };
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
  const segment = buildSegment(s.checkin, s.checkout, s.roomId, s.numRooms, s.discountPct);
  const rows = segment.rooms.flatMap((r) => r.pricingRows);
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

    segments: [segment],

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

// ─────────── Users ───────────
export const SEED_USERS: User[] = [
  {
    id: "u-sales",
    name: "Sales User",
    role: "Sales",
    email: "sales@vamaretreats.com",
    color: "#172f24",
    active: true,
    password: "test@123",
  },
  {
    id: "u-frontoffice",
    name: "Front Office",
    role: "Front Office",
    email: "frontoffice@vamaretreats.com",
    color: "#1a4fd6",
    active: true,
    password: "test@123",
  },
  {
    id: "u-admin",
    name: "Admin",
    role: "Admin",
    email: "admin@vamaretreats.com",
    color: "#0f2318",
    active: true,
    password: "test@123",
  },
];

// Backwards-compatible alias for any consumer that still imports USERS
export const USERS = SEED_USERS;

// ─────────── Discount caps + package rates ───────────
export const SEED_DISCOUNT_CAPS: DiscountCaps = {
  sales: 20,
  admin: null,
};

export const SEED_PACKAGE_RATES: PackageRates = {
  mealPerAdultPerNight: 2100,
  petPerPetPerNight: 1200,
  driverPerNight: 1500,
  individualBreakfast: 300,
  individualLunchHighTea: 700,
  individualOnlyDinner: 800,
  individualBbqEveningDinner: 1300,
};

export const SEED_GST_SETTINGS: GstSettings = {
  threshold: 7500,
  belowRate: 5,
  aboveRate: 18,
};

export const SEED_CANCELLATION_POLICY: CancellationPolicy = {
  standardThreshold: 5,
  specialThreshold: 10,
  standardAbove: { cancellationChargePct: 0,  refundPct: 100, creditNotePct: null },
  standardBelow: { cancellationChargePct: 0,  refundPct: null, creditNotePct: 100 },
  specialAbove:  { cancellationChargePct: 0,  refundPct: 100, creditNotePct: null },
  specialBelow:  { cancellationChargePct: 50, refundPct: null, creditNotePct: 50  },
  notes: [
    "Above policy is applicable for accommodation charges.",
    "Meal charges will be refunded 100% for cancellation upto 1 day before check-in date.",
    "Credit note is not valid for use on Saturdays or any peak days like Diwali, Dusherra, Ugaadi, Republic Day, Independence Day, Good Friday, Christmas, New Year.",
    "Refunds shall be processed through bank transfer only.",
  ],
};

// ─────────── Special Days (2026 seed) ───────────
// Variable-date entries (Diwali, Dussehra, Ugaadi, Good Friday) are approximate;
// Admin can edit via /master-setup.
export const SEED_SPECIAL_DAYS: SpecialDay[] = [
  { id: "sd-newyear", date: "2026-01-01", name: "New Year" },
  { id: "sd-republic", date: "2026-01-26", name: "Republic Day" },
  { id: "sd-goodfriday", date: "2026-04-03", name: "Good Friday" },
  { id: "sd-ugaadi", date: "2026-04-09", name: "Ugaadi" },
  { id: "sd-indday", date: "2026-08-15", name: "Independence Day" },
  { id: "sd-dussehra", date: "2026-10-19", name: "Dussehra" },
  { id: "sd-diwali", date: "2026-11-08", name: "Diwali" },
  { id: "sd-christmas", date: "2026-12-25", name: "Christmas" },
];

// ─────────── Credit Note settings ───────────
export const SEED_CREDIT_NOTE_SETTINGS: CreditNoteSettings = {
  prefix: "CRV",
  nextNumber: 1,
};

// ─────────── Venues (B2B Phase 2 — name-only catalog for now) ───────────
export const SEED_VENUES: Venue[] = [];

// ─────────── Venue Blocks (manual reservations on the room chart) ───────────
export const SEED_VENUE_BLOCKS: VenueBlock[] = [];

// ─────────── Bulk Room Blocks ───────────
export const SEED_BULK_ROOM_BLOCKS: BulkRoomBlock[] = [];
