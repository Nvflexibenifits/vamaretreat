export type Role = "Sales" | "Front Office" | "Admin";

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
  price: number;
  weekdayDiscount: number;   // Sun–Thu
  fridayDiscount: number;    // Friday
  weekendDiscount: number;   // Saturday
  specialDayDiscount: number; // Special / Peak Days
};

export type GstSettings = {
  threshold: number;
  belowRate: number;
  aboveRate: number;
};

export type CancellationPolicyCell = {
  cancellationChargePct: number;
  refundPct: number | null;
  creditNotePct: number | null;
};

export type CancellationPolicy = {
  standardThreshold: number;
  specialThreshold: number;
  standardAbove: CancellationPolicyCell;
  standardBelow: CancellationPolicyCell;
  specialAbove: CancellationPolicyCell;
  specialBelow: CancellationPolicyCell;
  notes: string[];
};

export type RoomInventoryItem = {
  id: string;
  label: string;
  type: string;
  cat: string;
  active: boolean;
  blockedReason?: string;
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
  gst?: number;
  totalPaid?: number;
  date: string;
  by: string;
};

export type PricingRowType = "sun-thu" | "fri" | "sat" | "fri-sat" | "custom";

export type PricingRow = {
  rowType: PricingRowType;
  roomId: string;
  roomName: string;
  checkin: string;
  checkout: string;
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

export type SegmentRoom = {
  id: string;
  roomId: string;
  roomName: string;
  numRooms: number;
  discountPct: number;
  pricingRows: PricingRow[];
  netCharges: number;
  gstAmt: number;
  totalAmt: number;
};

export type BookingSegment = {
  id: string;
  checkin: string;
  checkout: string;
  rooms: SegmentRoom[];
  segmentTotal: number;
  // Per-segment guest counts
  adults: number;
  seniors: number;
  kidsAbove10: number;
  kids6to10: number;
  kids2to6: number;
  infantsBelow2: number;
  pets: number;
  // Per-segment meal
  mealOn: boolean;
  drivers: number;
  driverMealOn: boolean;
  // Editable per-segment rates (fall back to master package rates when absent)
  mealRate?: number;
  petRate?: number;
  driverMealRate?: number;
  mealTotal: number;
  mealGst: number;
  mealWithGst: number;
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

export type RoomNightUpgrade = {
  fromCategory: string;
  fromCategoryName: string;
  toCategory: string;
  toCategoryName: string;
  upgradeDate: string;
  kind: "complimentary" | "paid";
  extraAmount: number;
  reason?: string;
  by: string;
};

export type RoomNightOverride = {
  date: string;
  fromRoomId: string;
  toRoomId: string;
  upgrade?: RoomNightUpgrade;
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

  segments: BookingSegment[];

  mealOn: boolean;
  mealTotal: number;
  mealGst: number;
  petTotal: number;
  petGst: number;
  driverCount?: number;
  driverTotal?: number;
  driverGst?: number;
  driverMealOn?: boolean;
  driverMealTotal?: number;
  driverMealGst?: number;

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

  nightOverrides?: RoomNightOverride[];
};

export type RevenueEntry = Payment & {
  bookingId: string;
  guest: string;
};

export type NotifKind = "success" | "error";

export type SpecialDay = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
};

export type CreditNoteSettings = {
  prefix: string;
  nextNumber: number;
};

export type DiscountCaps = {
  sales: number;
  admin: number | null; // null = Unlimited
};

export type MealCustomRow = {
  id: string;
  label: string;
  price: number;
  perLabel: string;
};

export type PackageRates = {
  mealPerAdultPerNight: number;
  petPerPetPerNight: number;
  driverPerNight: number;
  individualBreakfast: number;
  individualLunchHighTea: number;
  individualOnlyDinner: number;
  individualBbqEveningDinner: number;
  customPackages?: MealCustomRow[];
  customIndividualMeals?: MealCustomRow[];
};

export type User = {
  id: string;
  name: string;
  role: Role;
  email: string;
  color: string;
  active: boolean;
  password?: string;
};

export type VenueType = string;

export type Venue = {
  id: string;
  name: string;
  type: VenueType;
  capacity?: number;
  notes?: string;
  active: boolean;
};

export type BulkRoomBlockRow = {
  catId: string;
  catName: string;
  roomIds: string[];
};

export type BulkRoomBlock = {
  id: string;
  label: string;
  guestName: string;
  checkin: string;
  checkout: string;
  pax: number;
  amount: number;
  status: "Tentative" | "Confirmed";
  rows: BulkRoomBlockRow[];
  createdBy: string;
  createdAt: string;
};

export type VenueBlock = {
  id: string;
  venueId: string;
  checkin: string;
  checkout: string;
  name: string;
  pax: number;
  amount: number;
  status?: "Tentative" | "Confirmed";
  createdBy: string;
  createdAt: string;
};
