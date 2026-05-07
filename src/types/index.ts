export type Role = "Sales REX" | "Room Allocator" | "Manager" | "Admin";

export type BookingStatus = "Draft" | "Confirmed" | "Completed" | "Lost";

export type RoomMaster = {
  id: string;
  name: string;
  wd: number;
  wknd: number;
  gst: number;
};

export type RoomInventoryItem = {
  id: string;
  label: string;
  type: string;
  cat: string;
};

export type BookingRoom = {
  id: string;
  name: string;
  qty: number;
};

export type Payment = {
  date: string;
  time: string;
  type: string;
  amount: number;
  mode: string;
  by: string;
};

export type Extra = {
  name: string;
  amount: number;
};

export type Booking = {
  id: string;
  guest: string;
  mobile: string;
  email: string;
  source: string;
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  kids: number;
  rooms: BookingRoom[];
  roomTotal: number;
  discPct: number;
  discAmt: number;
  netRoom: number;
  gstRoom: number;
  mealOn: boolean;
  mealTotal: number;
  mealGst: number;
  total: number;
  advance: number;
  balance: number;
  status: BookingStatus;
  rex: string;
  allocatedRoom: string | null;
  notes: string;
  payments: Payment[];
  extras: Extra[];
  lostReason?: string;
  lostNotes?: string;
};

export type RevenueEntry = Payment & {
  bookingId: string;
  guest: string;
};

export type NotifKind = "success" | "error";

export type PriceCalc = {
  roomTotal: number;
  discAmt: number;
  netRoom: number;
  gstRoom: number;
  mealBase: number;
  mealGst: number;
  total: number;
  adv: number;
  balance: number;
  nights: number;
  adults: number;
  discPct: number;
  mealOn: boolean;
};
