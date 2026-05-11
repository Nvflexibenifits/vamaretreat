export type Role = "Sales REX" | "Room Allocator" | "Manager" | "Admin";

export type BookingStatus =
  | "Enquiry"
  | "Tentative"
  | "Confirmed"
  | "Completed"
  | "Lost"
  | "Cancelled";

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
  date: string;
  by: string;
};

export type PricingRowType = "sun-thu" | "fri-sat" | "custom";

export type PricingRow = {
  rowType: PricingRowType;
  roomId: string;
  roomName: string;
  tariff: number;
  nights: number;
  numRooms: number;
  roomCharges: number;
  discountPct: number;
  discountAmt: number;
  netCharges: number;
  gstRate: number;
  gstAmt: number;
  totalAmt: number;
};

export type AppliedCreditNote = {
  code: string;
  amount: number;
};

export type CancellationDetails = {
  cancellationDate: string;
  daysBeforeCheckin: number;
  policyType: "standard" | "special";
  cancellationCharge: number;
  refundAmount: number;
  creditNoteAmount: number;
  resolution: "refund" | "credit-note";
  creditNoteCode?: string;
  processedBy: string;
};

export type CreditNoteTransaction = {
  date: string;
  bookingId: string;
  amountUsed: number;
  remainingAfter: number;
};

export type CreditNote = {
  code: string;
  guestName: string;
  guestMobile: string;
  originalBookingId: string;
  cancellationDate: string;
  totalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  status: "Available" | "Partially Used" | "Fully Used";
  transactions: CreditNoteTransaction[];
};

export type Booking = {
  id: string;
  guest: string;
  mobile: string;
  email: string;
  source: string;
  notes: string;
  rex: string;

  checkin: string;
  checkout: string;
  nights: number;

  adults: number;
  kidsAbove10: number;
  kids6to10: number;
  kids2to6: number;
  infantsBelow2: number;
  seniors: number;
  pets: number;

  pricingRows: PricingRow[];

  mealOn: boolean;
  mealTotal: number;
  mealGst: number;
  petTotal: number;
  petGst: number;

  totalRoomCharges: number;
  totalMealCharges: number;
  grandTotal: number;

  creditNoteApplied?: AppliedCreditNote;

  advance: number;
  balance: number;

  status: BookingStatus;
  allocatedRooms: string[];

  payments: Payment[];
  extras: Extra[];

  lostReason?: string;
  lostNotes?: string;
  cancellationDetails?: CancellationDetails;
};

export type RevenueEntry = Payment & {
  bookingId: string;
  guest: string;
};

export type NotifKind = "success" | "error";
