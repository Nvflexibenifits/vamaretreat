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
  // Set when mode is "Credit Note" — the code of the redeemed note
  creditNoteCode?: string;
};

// Revenue head an amount reports under in the Revenue Register.
export type ChargeHead = "room" | "meal" | "other";

// Master-setup item: an add-on charge line offerable on a booking. Amount and
// GST are entered per booking, so the master carries only the label and the
// revenue head the charge reports under.
export type AddOnCategory = {
  id: string;
  name: string;
  head: ChargeHead;
};

export type Extra = {
  name: string;
  amount: number;
  gst?: number;
  totalPaid?: number;
  date: string;
  by: string;
  // Which revenue column this add-on reports under. Set from the category
  // picked on the booking form; absent on legacy rows, where the head is
  // inferred from the name (see extraHead in lib/utils).
  head?: ChargeHead;
};

// OTA settlement deductions: the OTA pays out net of these, so each row
// subtracts (amount + gst) from the booking's receivable.
export type DeductionType = "Commission" | "TDS" | "Special Discount";

export type Deduction = {
  type: DeductionType;
  amount: number; // base amount deducted
  gst: number;    // GST on the deduction — also subtracted (reverse of add-ons)
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
  // Physical room ids held for THIS segment's date range only. Bookings saved
  // before per-segment allocation lack this and fall back to the booking-level
  // allocatedRooms across the whole stay.
  allocatedRooms?: string[];
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
  // Meal line items picked from the meal master (new model); segments saved
  // before this exist only with the mealOn/mealRate fields above
  mealItems?: SegmentMealItem[];
  mealTotal: number;
  mealGst: number;
  mealWithGst: number;
};

export type AppliedCreditNote = {
  code: string;
  amount: number;
};

export type RefundPayout = {
  date: string;
  amount: number;
  mode: string;
  reference?: string;
  by: string;
};

export type CancellationDetails = {
  cancellationDate: string;
  daysBeforeCheckin: number;
  policyType: "standard" | "special";
  cancellationCharge: number;
  refundAmount: number;
  creditNoteAmount: number;
  // Percentages actually applied (including per-booking overrides)
  refundPct?: number;
  creditNotePct?: number;
  resolution: "refund" | "credit-note";
  creditNoteCode?: string;
  processedBy: string;
  // Actual payouts made against refundAmount, recorded from the booking page
  refundPayouts?: RefundPayout[];
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
  // Date the booking was made (YYYY-MM-DD); legacy bookings may lack it
  createdAt?: string;

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
  // OTA bookings only: commission / TDS / special discount withheld by the
  // OTA. The booking settles against grandTotal minus these.
  deductions?: Deduction[];

  lostReason?: string;
  lostNotes?: string;
  cancellationDetails?: CancellationDetails;

  // Cancellation settlement: unpaid balance written off across the three
  // charge heads. Original charge figures stay untouched for audit; revenue
  // reporting subtracts these lines.
  waiveOff?: WaiveOff;

  nightOverrides?: RoomNightOverride[];
};

export type WaiveOffLine = {
  head: ChargeHead;
  amount: number; // net (pre-GST) amount waived from this head
  gstPct: number;
  gstAmt: number;
};

export type WaiveOff = {
  lines: WaiveOffLine[];
  totalGross: number; // sum of amount + gstAmt across lines
  date: string;
  by: string;
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

export type MealPackage = {
  id: string;
  name: string;
  rate: number;
};

export type MealCategory = {
  id: string;
  name: string;
  packages: MealPackage[];
};

// A meal line item on a booking segment, picked from the meal master
export type SegmentMealItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  packageId: string;
  packageName: string;
  rate: number;
  pax: number;
  total: number;
};

export type CountryCode = {
  name: string;
  dial: string;
  minLen: number;
  maxLen: number;
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

// Guest counts on a room-chart block, using the same buckets as a booking so
// the two screens ask for the same thing. `pax` on the block stays as the
// derived head count for legacy blocks and compact displays.
export type BlockGuestCounts = {
  adults: number;
  seniors: number;
  kidsAbove10: number;
  kids6to10: number;
  kids2to6: number;
  infantsBelow2: number;
  pets: number;
  drivers: number;
};

export type BulkRoomBlock = {
  id: string;
  label: string;
  guestName: string;
  checkin: string;
  checkout: string;
  pax: number;
  // Absent on blocks saved before the breakdown existed — `pax` is all there is
  guests?: BlockGuestCounts;
  amount: number;
  status: "Tentative" | "Confirmed" | "Maintenance";
  // Maintenance blocks only — why the rooms are out of service
  reason?: string;
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
  guests?: BlockGuestCounts;
  amount: number;
  status?: "Tentative" | "Confirmed" | "Maintenance";
  // Maintenance blocks only — why the venue is out of service
  reason?: string;
  createdBy: string;
  createdAt: string;
};
