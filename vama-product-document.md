# Vama Retreats — Back Office System
## Product Requirements & User Journey Document
**Version 1.0 | May 2026**

---

## 1. OVERVIEW

Vama Retreats is a resort property near Nandi Hills, Bangalore. This back office system replaces WhatsApp conversations and manual Excel sheets with a single unified platform for managing bookings, rooms, revenue, and guests.

**Property Details:**
- Address: Survey Number 27-1, Canterbury Castles Layout, Oodanahalli, near Nandi Hills
- Contact: 80881 75568

**Room Inventory:**
| Room Type | Count | Weekday Rate | Weekend Rate | GST |
|---|---|---|---|---|
| Tent | 6 | ₹3,800 | ₹4,500 | 5% |
| Couple Room | 10 | ₹6,500 | ₹7,500 | 5% |
| Family Room | 4 | ₹8,000 | ₹9,000 | 18% |
| 1BHK Villa | 12 | ₹8,800 | ₹9,800 | 18% |
| 1BHK Garden View | 8 | ₹10,500 | ₹11,500 | 18% |
| 2BHK Villa | 5 | ₹12,000 | ₹13,000 | 18% |
| 2BHK Garden View | 5 | ₹13,200 | ₹14,200 | 18% |
| Pool Villa | 1 | ₹20,000 | ₹25,800 | 18% |

**Weekend = Friday night + Saturday night**
**Weekday = Sunday night + Monday night + Tuesday night + Wednesday night + Thursday night**

---

## 2. USER ROLES & ACCESS

### 2.1 Roles

| Role | Users | Access |
|---|---|---|
| Admin / Owner | Owner | Full access to everything |
| Manager | Priya | All bookings, revenue, reports, pricing |
| Sales REX | Karthik, Anagha | Create/edit bookings, view revenue |
| Room Allocator | Rahul | Room chart only, view bookings |

### 2.2 Discount Limits by Role
- Sales REX: max 20% on weekday, max 15% on weekend
- Manager: max 25% (any day)
- Admin: unlimited

### 2.3 Login Flow
1. User opens the app, sees a grid of user cards (Karthik, Anagha, Priya, Rahul, Owner)
2. User clicks their name
3. Password input appears below the grid
4. Password is same for all users: **test@123**
5. If wrong password: show error "Incorrect password. Please try again."
6. Eye icon to show/hide password
7. "Forgot Password?" link — shows message: "Please contact your administrator to reset your password."
8. On correct password: enter the app, directed to Dashboard
9. Logout button at bottom of sidebar

---

## 3. NAVIGATION STRUCTURE

### Sidebar Menu (top to bottom):
```
Home
Bookings  ▸  (expandable, arrow rotates when open)
   └─ B2C Bookings         → /bookings
   └─ Group Bookings        → Coming Soon (dimmed)
   └─ Corporate Bookings    → Coming Soon (dimmed)
   └─ School Bookings       → Coming Soon (dimmed)
   └─ Institute Bookings    → Coming Soon (dimmed)
Room Chart                  → /room-chart
Revenue                     → /revenue
Reports                     → /reports
Master Setup                → /master-setup
─────────────────────────────
Logout
```

- Bookings group auto-expands when user is on any /bookings page
- Coming Soon items are greyed out, not clickable, show "Coming Soon" pill
- Logout returns user to /login

---

## 4. DASHBOARD (Home Page)

URL: /

The dashboard shows three widgets. No arrivals list, no recent bookings table — just these three focused sections.

### Widget 1 — Revenue
- Title: "Revenue"
- Three filter buttons: **Today | This Week | This Month**
- Default: This Week
- Shows total revenue amount prominently (large number)
- Sub-label: "X payment events"
- Revenue is calculated from all payment entries in that period

### Widget 2 — Payment Pending
- Title: "Payment Pending"
- Table with columns: **Booking ID | Guest Name | Amount Pending**
- Shows all bookings where balance > 0
- Sorted by balance amount (highest first)
- Each row is clickable → goes to booking detail
- Empty state: "All bookings fully paid ✓"

### Widget 3 — Room Status
- Title: "Room Status"
- Two filter buttons: **Today | This Week**
- Default: Today
- Table columns: **Room Category | Mon | Tue | Wed | Thu | Fri | Sat | Sun**
- Under each day show three numbers: **Booked / Tentative / Available**
  - Booked = Confirmed or Completed bookings on that day
  - Tentative = Tentative bookings on that day
  - Available = Total rooms in category − Booked − Tentative
- Room categories:
  | Category | Total Rooms |
  |---|---|
  | Pool Villa | 1 |
  | 2BHK Villa | 5 |
  | 1BHK Villa | 12 |
  | Family Room | 4 |
  | Couple Room | 10 |
  | Tent | 6 |

---

## 5. B2C BOOKINGS MODULE

### 5.1 Bookings List Page
URL: /bookings

**Page Elements:**
- Title: "B2C Bookings"
- "+ Create New Booking" button top right → /bookings/new
- Search bar: search by guest name, mobile, booking ID
- Filter buttons: **All | Enquiry | Tentative | Confirmed | Completed | Lost | Cancelled**
- Date range filter: From date | To date | Clear

**Table Columns:**
Booking ID | Guest Name | Mobile | Check-in | Check-out | Rooms | Total Amount | Balance | Status | REX | Actions

**Actions per row:**
- "View" button → /bookings/[id]
- "Edit" button → /bookings/[id]/edit

**Status Badge Colors:**
| Status | Color |
|---|---|
| Enquiry | Grey |
| Tentative | Blue |
| Confirmed | Amber |
| Completed | Green |
| Lost | Red |
| Cancelled | Dark Red |

---

### 5.2 New Booking Page
URL: /bookings/new

**This is the most important page in the system.**

The REX uses this page to:
1. Capture guest details
2. Calculate pricing
3. Generate pricing sheet to share with guest on WhatsApp
4. Save the booking

---

#### SECTION 1 — Guest Information

**Card: "Guest Information"** (2-column grid)
| Field | Type | Required | Notes |
|---|---|---|---|
| Guest Name | Text | Yes | |
| Mobile Number | Tel | Yes | Must be exactly 10 digits |
| Email | Email | No | Optional |
| Enquiry Source | Dropdown | Yes | WhatsApp, Phone Call, Walk-in, Referral, OTA |
| Special Request / Notes | Text | No | Full width |

**Card: "Guest Count"** (3-column grid)
| Field | Type | Default | Notes |
|---|---|---|---|
| Adults | Number | 2 | Min 1 |
| Kids > 10 yrs | Number | 0 | Min 0 |
| Kids 6–10 yrs | Number | 0 | Min 0 |
| Kids 2–6 yrs | Number | 0 | Min 0 |
| Infants < 2 yrs | Number | 0 | Min 0 |
| Senior Citizens | Number | 0 | Hint: "for room setup tracking only" |
| Pets | Number | 0 | Max 2, Hint: "max 2 per villa" |

---

#### SECTION 2 — Stay Dates & Pricing Table

**Date Selection:**
- Check-in Date (required)
- Check-out Date (required, must be after check-in)
- Nights: auto-calculated, read only

**Auto Date Split Logic:**

When both dates are selected, the system automatically generates pricing rows by splitting the stay into weekday and weekend buckets.

**How the split works:**
- Look at each night of the stay one by one
- A night belongs to the day it starts (check-in of that night)
- Friday night and Saturday night → "Fri–Sat" row → WEEKEND tariff → max discount 15%
- All other nights (Sun/Mon/Tue/Wed/Thu) → "Sun–Thu" row → WEEKDAY tariff → max discount 20%

**Examples:**

*Example 1: Check-in Wednesday, Check-out Sunday (4 nights)*
- Wednesday night → weekday
- Thursday night → weekday
- Friday night → weekend
- Saturday night → weekend
→ Creates 2 rows: Row 1 (Sun–Thu, 2 nights) + Row 2 (Fri–Sat, 2 nights)

*Example 2: Check-in Monday, Check-out Wednesday (2 nights)*
- Monday night → weekday
- Tuesday night → weekday
→ Creates 1 row: Row 1 (Sun–Thu, 2 nights)

*Example 3: Check-in Friday, Check-out Sunday (2 nights)*
- Friday night → weekend
- Saturday night → weekend
→ Creates 1 row: Row 1 (Fri–Sat, 2 nights)

*Example 4: Check-in Thursday, Check-out Monday (4 nights)*
- Thursday night → weekday
- Friday night → weekend
- Saturday night → weekend
- Sunday night → weekday
→ Creates 2 rows: Row 1 (Sun–Thu, 2 nights) + Row 2 (Fri–Sat, 2 nights)

**Rules:**
- Only create a row if that type exists in the stay
- When dates change, regenerate auto rows but keep any manually added custom rows
- User can add more rows manually with "+ Add Row" button

**Pricing Table Columns:**
| Column | Type | Notes |
|---|---|---|
| Day Type | Label | "Sun–Thu", "Fri–Sat", or "Custom" — read only |
| Room Category | Dropdown | All 8 room types |
| Room Tariff | Number | Auto-filled, editable |
| No. of Nights | Number | Read only, auto |
| No. of Rooms | Number | Min 1, default 1 |
| Room Charges | Number | Read only: Tariff × Nights × Rooms |
| Discount % | Number | Editable, max enforced per row type |
| Discount Amt | Number | Read only: Room Charges × Discount% ÷ 100 |
| Net Charges | Number | Read only: Room Charges − Discount Amt |
| GST Rate | % | Read only, auto from room type (5% or 18%) |
| GST Amt | Number | Read only: Net Charges × GST Rate ÷ 100 |
| Total Amt | Number | Read only: Net Charges + GST Amt |
| Delete (×) | Button | Removes this row |

**Table Footer Row (bold, highlighted):**
"Total Room Charges (A)" | — | — | — | Sum | Sum | Sum | — | Sum | **Sum**

**+ Add Row button:**
- Adds a new empty Custom row
- User selects room category and fills discount
- Max discount for custom rows: 20%

---

#### SECTION 3 — Meal & Pet Charges

**Meal Package:**
- Radio buttons: "Include Meal & Activity Package? ○ Yes ● No" (default: No)
- If Yes: show meal row
  | Field | Value |
  |---|---|
  | Meal Tariff | ₹2,100 (fixed, read only) |
  | No. of Nights | auto from stay |
  | No. of Pax | auto from Adults count |
  | Meal Charges | 2,100 × Nights × Pax |
  | GST Rate | 18% |
  | GST Amt | Meal Charges × 18% |
  | Total Meal | Meal Charges + GST Amt |

**Pet Package:**
- Only shows if Pets > 0 in Section 1
- Show pet row automatically:
  | Field | Value |
  |---|---|
  | Pet Tariff | ₹1,200 (fixed, read only) |
  | No. of Nights | auto from stay |
  | No. of Pax | auto from Pets count |
  | Pet Charges | 1,200 × Nights × Pets |
  | GST Rate | 18% |
  | GST Amt | Pet Charges × 18% |
  | Total Pet | Pet Charges + GST Amt |

**Summary:** "Total Meal & Pet Charges (B) = ₹XX,XXX"

---

#### SECTION 4 — Totals & Payment

| Field | Notes |
|---|---|
| Total Room Charges (A) | Sum of all pricing row Total Amts |
| Total Meal & Pet Charges (B) | Sum of meal + pet totals |
| **Total Amount Payable (A+B)** | **Show large and prominent** |
| Advance Amount Paid | Number input, default 0 |
| Payment Mode | Dropdown: UPI/QR, Cash, Bank Transfer |
| Balance at Check-in | Auto: Total − Advance. Amber if > 0, Green if 0 |

---

#### SECTION 5 — Action Buttons

Three buttons at the bottom:

**Button 1: "Save as Enquiry"** (ghost/outline style)
- Saves booking with status = "Enquiry"
- Room is NOT blocked
- Room chart does NOT show this booking
- After save:
  1. Open /bookings/[newId]/confirmation in a NEW TAB
  2. Redirect current page to /bookings/[newId]

**Button 2: "Book Tentatively"** (primary dark green)
- Saves booking with status = "Tentative"
- System automatically assigns a room from available inventory
  - Finds first available room of the selected room type for those dates
  - If no room available: show error "No [room type] available for selected dates"
- Room chart SHOWS this booking as tentatively blocked
- After save:
  1. Open /bookings/[newId]/confirmation in NEW TAB
  2. Redirect to /bookings/[newId]

**Button 3: "Confirm Booking"** (amber accent style)
- Only ENABLED if Advance Amount > 0
- If Advance = 0: button is greyed out, show hint "Enter advance amount to confirm"
- Saves booking with status = "Confirmed"
- System automatically assigns room if not already assigned
- Room chart shows this booking as confirmed
- After save:
  1. Open /bookings/[newId]/confirmation in NEW TAB
  2. Redirect to /bookings/[newId]

---

#### VALIDATION RULES
- Guest Name: not empty → "Name is required"
- Mobile: exactly 10 digits → "Enter valid 10-digit mobile number"
- Check-in: must be selected → "Select check-in date"
- Check-out: must be selected and after check-in → "Check-out must be after check-in"
- Pricing rows: at least one row with room category selected → "Please select room category in at least one row"

---

### 5.3 Booking Confirmation Sheet (Pricing Sheet)

URL: /bookings/[id]/confirmation

**IMPORTANT:**
- This page is OUTSIDE the dashboard layout (no sidebar, no topbar)
- Opens in a NEW TAB
- Has a "🖨 Print / Download PDF" button that calls window.print()
- Print button hidden when printing (@media print)
- REX takes a screenshot/photo and shares on WhatsApp with guest

**Exact Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ VAMA          BOOKING CONFIRMATION          REX: [Name]     │
│ RETREATS                                    (yellow bg)     │
│─────────────────────────────────────────────────────────────│
│    Survey Number 27-1, Canterbury Castles Layout,           │
│         Oodanahalli, near Nandi Hills                       │
│  Resort Contact - Please contact 80881 75568                │
│       for any assistance to reach the site.                 │
│─────────────────────────────────────────────────────────────│
│ GUEST INFO BLOCK (two columns)                              │
│ Left:                    Right:                             │
│ Guest Name | [name]      Adults        | [n]               │
│ Mobile No. | [mobile]    Kids > 10 Yrs | [n]               │
│ Check-In   | [date]      Kids 6-10 Yrs | [n]               │
│ Check-Out  | [date]      Kids 2-6 Yrs  | [n]               │
│ No. Nights | [n]         Infant < 2 Yrs| [n]               │
│ Room Disc  |[n]Nts|[%]%  Senior Citizens| [n]              │
│                          Pets          | [n]               │
│─────────────────────────────────────────────────────────────│
│ ACCOMMODATION CHARGES TABLE                REX: [Name]     │
│ Room Cat|Tariff|Nights|Rooms|Chgs|Disc|Net|GST%|GST|Total  │
│ [rows from pricingRows]                                     │
│ Total Room Charges (A)  |     |    |    |    |    |[total] │
│─────────────────────────────────────────────────────────────│
│ MEAL CHARGES TABLE (only if meal or pets)                   │
│ Meal Charges|Tariff|Nights|Pax|Chgs|--|--|GST%|GST|Total   │
│ Meal & Activity Package | 2100 | [n] | [n] | ...           │
│ Pet Package             | 1200 | [n] | [n] | ...           │
│ Total Meal Charges (B)  |                       |[total]   │
│─────────────────────────────────────────────────────────────│
│ Total Amt Payable (A+B)            |[raw]|[gst]|[grand]    │
│─────────────────────────────────────────────────────────────│
│ Advance Amount Paid                          [YELLOW: amt]  │
│ Balance Amount Payable at Check-In           [YELLOW: amt]  │
│─────────────────────────────────────────────────────────────│
│ MEAL PREFERENCE        │ SPECIAL REQUEST                    │
│ [Included/Not Included]│ [notes]                           │
│─────────────────────────────────────────────────────────────│
│ POLICIES (two column layout, font size 11px)                │
│ Left Column:           │ Right Column:                      │
│ CHECK-IN & CHECK-OUT   │ ITEMS TO CARRY                    │
│ MEAL PACKAGE           │ PET POLICY                        │
│ ACTIVITIES             │ SWIMMING POOL                     │
│ DRIVER/ATTENDANT       │ PAYMENT POLICIES                  │
│ PARKING                │ GENERAL RULES                     │
└─────────────────────────────────────────────────────────────┘
```

**Full Policy Text:**

LEFT COLUMN:

**CHECK-IN & CHECK-OUT TIMINGS**
1. Standard check-in time is 2 PM & check-out time is 11 AM.
2. Early check-in & late check-out is subject to availability. No early check-in & late check-out on Saturdays.
3. Guests can arrive at 1 PM & have lunch, but room allocation will be done at 2 PM.
4. In case guests are staying for lunch on the day of check-out, rooms will have to be vacated at 11AM.

**MEAL PACKAGE**
1. Meal package includes buffet lunch, high tea, BBQ, dinner on the day of check-in and morning tea & breakfast on the day of check-out.
2. We do not serve a-la-carte menu.
3. We do not provide room service / table service.
4. We provide only chicken in non-veg, we do not provide fish or mutton.
5. Buffet lunch counter closes at 3PM. Limited lunch menu items can be provided between 3-4 PM.
6. We do not provide liquor. Soft drinks & soda is provided.

**ACTIVITIES INCLUDED IN THE PACKAGE**
1. Adventure Course | Air Rifle Firing | Morning Trek | Nature walk | Swimming Pool
2. Cycling, Volleyball, Cricket, Indoor Games (Table Tennis, Foosball, Snooker, Carrom & Board Games)
3. Activities are subject to weather conditions.
4. Transportation to trek starting point should be arranged by guests themselves. We do not provide the same.
5. VAMA is absolved from any risk of injury in outdoor activities.

**DRIVER / ATTENDANT POLICIES**
1. Accommodation & bedding is provided free of cost for drivers/attendants. They must carry their own towels / toiletries.
2. Meal charges of Rs.1500 will apply in case drivers/attendants want to have guest food.
3. Driver/attendants are not permitted for activities.

**PARKING**
1. Surface parking is available. However, the same is at the owner's risk.

RIGHT COLUMN:

**ITEMS TO CARRY**
1. Pls carry Swimwear, sport shoes, track pants, sun cap, warm / rain jacket, umbrella.
2. Pls carry your own Toothbrush, toothpaste and shaving kit. Bath gel, shampoo & Bath towel is provided by VAMA.
3. Sports shoes / sneakers is mandatory to participate in adventure course & trekking.

**PET POLICY**
1. Pet Meal Package includes Rice, Curd, Boiled Vegetables, Boiled Eggs, Boiled Chicken and Chicken Broth. We do not provide Mutton, Fish & Dry Pet Food.
2. Pet should be kept on leash in common areas.
3. Pet owners should carry their own Pet Food Bowls & Poop Sticks.
4. A maximum of 2 pets are allowed in each Villa.

**SWIMMING POOL | TIMING 8 AM - 8 PM**
1. Usage of Swimming Pool is strictly in swimwear only. No T-Shirts, Dry Fits, Track Pants, Salwar Kameez, Sarees etc.
2. We DO NOT provide head cap. Ladies should carry their own head caps.

**PAYMENT POLICIES**
1. Balance Amount must be paid at the time of check-in, since we do not take credit card guarantee.
2. All adult guests will need to share mobile no. / photo ID at the time of check-in.
3. GST Invoice will be provided on request within 2 working days of check-out date. Pls note that GST is paid by us on all payments received.

**GENERAL RULES**
1. Pls note that there is 200 meters distance between our villas and dining area.
2. 1 BHK Garden Villas have a common garden between 2 villas.
3. Guests should refrain from playing own music in common areas.
4. In case of disturbance to other guests, music volume will need to be lowered.
5. Firecrackers and Confetti are not allowed.
6. Decoration inside and outside the villas is not allowed.
7. Drones are not allowed over swimming pool & pool villa.

---

### 5.4 Booking Detail Page

URL: /bookings/[id]

**Shows full booking information with action buttons based on current status.**

**Top Section — Status Bar:**
- Current status badge
- Assigned room (if any)
- Action buttons (context-aware, see below)
- "View Pricing Sheet" button → opens /bookings/[id]/confirmation in new tab

**Action Buttons by Status:**

| Current Status | Available Actions |
|---|---|
| Enquiry | "Book Tentatively", "Confirm Booking", "Mark as Lost" |
| Tentative | "Confirm Booking", "Record Payment", "Mark as Lost" |
| Confirmed | "Record Payment", "Add Extra Charges", "Complete Booking", "Cancel Booking" |
| Completed | View only |
| Lost | View only |
| Cancelled | View only |

**Main Content — Two columns:**

Left column:
- Guest & Booking details card
- Price Breakdown card
- Payment History card (all payments recorded)

Right column:
- Audit Trail (dark panel showing every action with timestamp and who did it)

**Payment History Card:**
Shows all payments made:
| Date | Type | Amount | Mode | Recorded by |
|---|---|---|---|---|

"+ Record Payment" button adds a new payment entry.
Each new payment reduces the balance.
Multiple payments allowed (guest can pay in parts).

**Record Payment Modal:**
- Amount (required, number)
- Payment Mode (UPI/QR, Cash, Bank Transfer)
- Payment Type (Advance, Partial Payment, Balance Payment)
- After recording: balance updates, if status was Enquiry/Tentative → auto-moves to Confirmed

**Add Extra Charges Modal:**
- Description (text)
- Amount (number)
- Multiple extras can be added
- Each extra adds to total and creates a revenue entry

**Complete Booking Flow:**
- Button: "Complete Booking"
- Opens modal asking for any final extra charges
- Option to extend stay (extra nights)
- On confirm: status → Completed, room freed in room chart

**Mark as Lost Modal:**
- Reason dropdown (required):
  - Price too high
  - Dates not available
  - No response from guest
  - Chose a competitor
  - Guest cancelled plans
  - Other
- Notes (optional)
- On confirm: status → Lost

---

### 5.5 Cancel Booking Flow

Only available for Confirmed bookings.

**Step 1:** REX clicks "Cancel Booking" on booking detail page

**Step 2:** System automatically calculates refund eligibility:

**Determine if Special Day or Standard Day:**
- Special Days list is configured in Master Setup
- Special Days include: Diwali, Dussehra, Ugaadi, Republic Day, Independence Day, Good Friday, Christmas, New Year (and any dates added by Admin)
- Check if the booking's check-in date falls on or within 3 days of a Special Day

**Cancellation Policy:**

| Type | Days Before Check-in | Cancellation Charge | Refund | Credit Note |
|---|---|---|---|---|
| Standard Day | > 5 days | NIL | 100% | — |
| Standard Day | ≤ 5 days | NIL | — | 100% |
| Special Day | > 10 days | NIL | 100% | — |
| Special Day | ≤ 10 days | 50% | — | 50% |

**Meal charges:** Always 100% refund if cancelled up to 1 day before check-in.

**Step 3:** System shows the cancellation summary:
- "Cancellation Policy Applied: [Standard/Special Day]"
- "Days before check-in: X days"
- "Refund Amount: ₹XX,XXX" OR "Credit Note Amount: ₹XX,XXX"
- "Cancellation Charge: ₹XX,XXX" (if applicable)

**Step 4:** REX selects guest's choice:
- Option A: "Process Refund" → marks as Refund Processed
- Option B: "Issue Credit Note" → system generates credit note

**Step 5 (if Credit Note):**
- System generates credit note with auto-incremented code (prefix configured in Master Setup, e.g. CRV001)
- Credit note stored in database
- REX shares the code with guest manually

**Step 6:** Booking status → Cancelled
- Room immediately freed in room chart
- Revenue entry updated

---

### 5.6 Credit Note System

**Credit Note Properties:**
| Field | Description |
|---|---|
| Code | Auto-generated, e.g. CRV001 (prefix configurable) |
| Guest Name | From original booking |
| Guest Mobile | From original booking |
| Original Booking ID | Source booking |
| Cancellation Date | Date cancelled |
| Total Amount | Full credit note value |
| Used Amount | Amount already consumed |
| Remaining Amount | Total − Used |
| Status | Available / Partially Used / Fully Used |
| Transactions | List of all uses (date, booking ID, amount used) |

**Applying Credit Note to New Booking:**
- In the Totals section of New Booking form, show a field: "Apply Credit Note"
- REX enters the credit note code
- System validates: code exists, status not "Fully Used", shows remaining balance
- REX enters amount to apply (cannot exceed remaining balance or booking total)
- System deducts from total: shows as a line item "Credit Note [CODE]: − ₹XX,XXX"
- After booking saved: credit note remaining balance updated
- If remaining = 0: status → "Fully Used"
- If remaining > 0: status → "Partially Used"

**Credit Notes can be used partially:**
Example: CRV001 = ₹10,000. New booking = ₹6,000. Apply ₹6,000 → remaining ₹4,000 still available.

---

### 5.7 Edit Booking Page

URL: /bookings/[id]/edit

**Same layout as New Booking page with these differences:**
- Page title: "Edit Booking — [Booking ID]"
- All fields pre-filled with existing booking data
- Booking ID never changes
- Advance already paid shown as read only (cannot reduce)
- Additional payments added via "Record Payment" on booking detail, not here

**Action Buttons:**
- "Save Changes" → updates booking, keeps same status, goes to /bookings/[id]
- "Save & View Pricing Sheet" → updates booking + opens confirmation in new tab
- "Cancel" → goes back to /bookings/[id] without saving

**What can be edited:**
- Guest details (name, mobile, email, source, notes)
- Guest counts (adults, kids, seniors, pets)
- Check-in / check-out dates
- Pricing rows (room type, discount, number of rooms)
- Meal package selection
- Status can be changed (Enquiry → Tentative → Confirmed)

---

## 6. ROOM CHART

URL: /room-chart

**Shows a 14-day calendar grid of all rooms and their occupancy.**

- Navigate with ◀ Previous / Next ▶ buttons (7 days at a time)
- Each row = one physical room
- Each column = one date
- Today's column highlighted

**Cell States:**
| State | Color | Meaning |
|---|---|---|
| Empty | White | Available |
| Amber | Amber background | Confirmed booking |
| Blue | Blue background | Tentative booking |
| Green | Green background | Completed booking |

**Clicking a booked cell** → opens booking detail in same tab

**Unallocated Bookings Banner:**
- Shows at top if any Confirmed/Tentative bookings have no room assigned
- Each booking shown as a card
- System auto-assigns rooms but if a conflict exists, REX can manually resolve

---

## 7. REVENUE

URL: /revenue

**Shows all payment events in a ledger view.**

- Month filter dropdown
- Export CSV button
- Three summary cards: Total Collected | Balance Pending | Confirmed Bookings

**Ledger Table:**
| Date | Booking ID | Guest | Event Type | Amount | Mode | Collected by |

Every payment event creates a row automatically:
- Advance payment
- Balance payment
- Partial payment
- Extra charges
- No manual entry needed — all auto-populated

---

## 8. REPORTS

URL: /reports

**Contains:**

### 8.1 Credit Notes Table
| Code | Guest Name | Original Booking | Total Amt | Used Amt | Remaining | Status | Date Issued |
|---|---|---|---|---|---|---|---|

Each row expandable to show transaction history.

### 8.2 (Future) Conversion Reports, Employee Performance, etc.

---

## 9. MASTER SETUP

URL: /master-setup

**Tabs:**

### 9.1 Pricing Master
Table of all room types with editable:
- Weekday rate
- Weekend rate
- GST rate

Packages:
- Meal & Activity Package: ₹2,100 per adult per night (editable)
- Pet Package: ₹1,200 per pet per night (editable)

### 9.2 Discount Rules
Set max discount % per role:
- Sales REX
- Manager
- Admin: Unlimited

### 9.3 GST Configuration
Set GST % per room category and package type.

### 9.4 Special Days
Calendar/list of special days for cancellation policy.
Admin can add/remove dates.
Pre-loaded: Diwali, Dussehra, Ugaadi, Republic Day (Jan 26), Independence Day (Aug 15), Good Friday, Christmas (Dec 25), New Year (Jan 1).

### 9.5 Credit Note Settings
- Prefix: text input (e.g. "CRV") — default CRV
- Next number: auto-incremented (e.g. 001, 002...)
- Preview: shows what next code will look like (e.g. CRV007)

### 9.6 User Management
Table of all users:
| Name | Role | Email | Status | Actions |
|---|---|---|---|---|

Add/Edit/Deactivate users.

---

## 10. DATA TYPES & STRUCTURE

### Booking Status Flow
```
Enquiry → Tentative → Confirmed → Completed
Enquiry → Lost
Tentative → Lost
Confirmed → Cancelled
```

### Booking Object
```typescript
type Booking = {
  id: string                    // VR-YYYY-NNN
  guest: string
  mobile: string
  email: string
  source: string
  checkin: string               // YYYY-MM-DD
  checkout: string              // YYYY-MM-DD
  nights: number
  adults: number
  kidsAbove10: number
  kids6to10: number
  kids2to6: number
  infantsBelow2: number
  seniors: number
  pets: number
  pricingRows: PricingRow[]
  mealOn: boolean
  mealTotal: number
  mealGst: number
  petTotal: number
  petGst: number
  totalRoomCharges: number      // Sum of all pricingRow totalAmt
  totalMealCharges: number      // mealTotal + mealGst + petTotal + petGst
  grandTotal: number            // totalRoomCharges + totalMealCharges
  creditNoteApplied?: {
    code: string
    amount: number
  }
  advance: number
  balance: number
  status: BookingStatus
  rex: string
  allocatedRoom: string | null
  notes: string
  payments: Payment[]
  extras: Extra[]
  lostReason?: string
  lostNotes?: string
  cancellationDetails?: CancellationDetails
}

type BookingStatus = 
  "Enquiry" | "Tentative" | "Confirmed" | 
  "Completed" | "Lost" | "Cancelled"

type PricingRow = {
  rowType: "sun-thu" | "fri-sat" | "custom"
  roomId: string
  roomName: string
  tariff: number
  nights: number
  numRooms: number
  roomCharges: number
  discountPct: number
  discountAmt: number
  netCharges: number
  gstRate: number
  gstAmt: number
  totalAmt: number
}

type Payment = {
  date: string
  time: string
  type: string
  amount: number
  mode: string
  by: string
}

type Extra = {
  name: string
  amount: number
  date: string
  by: string
}

type CancellationDetails = {
  cancellationDate: string
  daysBeforeCheckin: number
  policyType: "standard" | "special"
  cancellationCharge: number
  refundAmount: number
  creditNoteAmount: number
  resolution: "refund" | "credit-note"
  creditNoteCode?: string
  processedBy: string
}

type CreditNote = {
  code: string
  guestName: string
  guestMobile: string
  originalBookingId: string
  cancellationDate: string
  totalAmount: number
  usedAmount: number
  remainingAmount: number
  status: "Available" | "Partially Used" | "Fully Used"
  transactions: CreditNoteTransaction[]
}

type CreditNoteTransaction = {
  date: string
  bookingId: string
  amountUsed: number
  remainingAfter: number
}
```

---

## 11. KEY BUSINESS RULES

1. **Weekday vs Weekend:** Friday night and Saturday night = weekend. All other nights = weekday.

2. **Discount caps:** Sun–Thu rows max 20%, Fri–Sat rows max 15%, custom rows max 20%. Role-based limits also apply (REX cannot exceed role limit).

3. **Room visibility on chart:**
   - Enquiry → NOT visible on room chart
   - Tentative → visible (blue)
   - Confirmed → visible (amber)
   - Completed → visible (green)
   - Lost/Cancelled → NOT visible

4. **Room auto-assignment:** When status moves to Tentative or Confirmed, system auto-assigns first available room of selected type. If none available, show error.

5. **Revenue entries:** Auto-created on every payment event. Never manually entered.

6. **Multiple payments:** A booking can receive multiple partial payments. Each adds to advance, reduces balance.

7. **Credit notes:** Can be used partially across multiple bookings. Each use reduces remaining balance.

8. **Cancellation:** Only Confirmed bookings can be cancelled. Room freed immediately.

9. **Confirmation sheet:** Always opens in new tab. REX screenshots and sends via WhatsApp manually.

10. **Booking ID:** Never changes, even after edits. Format: VR-YYYY-NNN.

---

## 12. TECH STACK

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router |
| Language | TypeScript |
| Styling | Tailwind CSS + custom CSS variables |
| Fonts | Outfit (headings) + DM Sans (body) |
| State | React Context (useApp hook) |
| Database | TBD (Supabase or Neon — to be decided) |
| Auth | TBD (Supabase Auth or Clerk — to be decided) |
| Hosting | Vercel |

**Current state:** In-memory data only (no database yet). All data lives in the store (src/lib/store.tsx).

---

*Document maintained by: Product Team*
*Last updated: May 2026*
