# DB Migration Plan — Vama Retreat

Status: Planned · Not started  
Decision: Review this before the next sprint and decide on timing.

---

## Current State

- **DB (Neon + Drizzle):** Only the `users` table exists.
- **Everything else:** Stored in `localStorage` under key `vama:state:v2` via React Context in `src/lib/store.tsx`.
- **Risk:** All booking and financial data is browser-local. Clearing storage, switching devices, or opening a new browser loses all data.

---

## Tables to Create (14 new)

Existing: `users`

| Table | Purpose | Notes |
|---|---|---|
| `bookings` | Core booking records | Scalar fields as columns; `pricingRows`, `payments`, `extras`, `nightOverrides`, `allocatedRooms` as JSONB |
| `room_master` | 9 room categories + pricing/discount config | Seeded from `src/lib/data.ts` |
| `room_inventory` | 51 physical rooms | id, label, type, cat, active, blockedReason |
| `venues` | Venue definitions | Conference rooms, garden venues etc |
| `venue_blocks` | Venue booking blocks | FK to venues |
| `bulk_room_blocks` | Group room blocks | Header + rows array as JSONB |
| `special_days` | Peak/special day definitions | id, label, date |
| `credit_notes` | Credit note ledger | code, amounts, status; transactions as JSONB |
| `guest_notes` | CRM notes | Keyed by mobile number |
| `app_config` | Singleton config store | Key-value table (key: text PK, value: JSONB) |

### `app_config` keys (5 singletons)

| Key | What it holds |
|---|---|
| `gst_settings` | threshold, belowRate, aboveRate |
| `discount_caps` | sales cap %, admin cap (null = unlimited) |
| `package_rates` | meal/adult/night, pet/night, driver/night, à la carte rates |
| `cancellation_policy` | standard/special thresholds + 4 policy cells |
| `credit_note_settings` | prefix string + next number counter |

### Why JSONB for booking arrays?

`payments`, `pricingRows`, `extras`, `nightOverrides`, and `allocatedRooms` are always read and written as a unit with their parent booking. They are never queried independently. JSONB keeps the schema flat and the existing TypeScript data model works without any mapping layer.

---

## API Routes — 35 total

### Already built (7)

```
POST  /api/auth/login
POST  /api/auth/logout
GET   /api/auth/me
GET   /api/users
POST  /api/users
PATCH /api/users/[id]
DELETE /api/users/[id]
```

### New routes (28)

#### Bootstrap
```
GET   /api/bootstrap
```
Single call on app load. Returns all data: bookings, rooms, inventory, venues,
venueBlocks, bulkBlocks, creditNotes, guestNotes, config (all 5 keys), specialDays.

#### Bookings
```
GET    /api/bookings
POST   /api/bookings
GET    /api/bookings/[id]
PATCH  /api/bookings/[id]    ← covers all mutations (status, payments, extras, allocations, overrides)
DELETE /api/bookings/[id]    ← admin only
```

#### Master Setup
```
GET    /api/master/rooms
PUT    /api/master/rooms                    ← full array replace
GET    /api/master/inventory
POST   /api/master/inventory
PATCH  /api/master/inventory/[id]
DELETE /api/master/inventory/[id]
GET    /api/master/config                   ← all 5 singleton keys
PUT    /api/master/config/[key]             ← update one key
GET    /api/master/special-days
POST   /api/master/special-days
DELETE /api/master/special-days/[id]
```

#### Venues & Blocks
```
GET    /api/venues
POST   /api/venues
PATCH  /api/venues/[id]
DELETE /api/venues/[id]

GET    /api/venue-blocks
POST   /api/venue-blocks
PATCH  /api/venue-blocks/[id]
DELETE /api/venue-blocks/[id]

GET    /api/bulk-blocks
POST   /api/bulk-blocks
PATCH  /api/bulk-blocks/[id]
DELETE /api/bulk-blocks/[id]
```

#### Credit Notes
```
GET    /api/credit-notes
GET    /api/credit-notes/[code]
POST   /api/credit-notes
PATCH  /api/credit-notes/[code]    ← apply usage
```

#### Guest Notes
```
GET    /api/guest-notes
PUT    /api/guest-notes/[mobile]
```

---

## Store Refactor (`src/lib/store.tsx`)

**Today:** Every mutation → `setState` → write `localStorage`

**After:** Every mutation → `PATCH /api/...` → on 200 → `setState`. localStorage dropped entirely.

The `useApp()` hook interface stays identical — no component changes needed. Only the internals of `store.tsx` change. On mount, instead of reading `vama:state:v2` from localStorage, it calls `GET /api/bootstrap`.

```
Current:  Action → setState → localStorage.setItem(...)
New:      Action → fetch(API) → on success → setState
```

---

## Auth Middleware

One `src/middleware.ts` that protects all `/api/*` routes except `/api/auth/*`.  
Reads the `vama-session` JWT cookie on every request.  
Role checks (Admin-only) happen inside individual route handlers → return 403 for unauthorized.

---

## What Stays Client-Only (Not in DB)

- Hover state, drag state, modal open/close — purely UI
- `revenueEntries` — derived from bookings, computed on client
- Notification toasts
- Room chart date offset / scroll position

---

## Implementation Order

1. Drizzle schema — add all 14 tables, generate + run migration
2. Seed script — room_master, room_inventory, app_config defaults, users
3. `GET /api/bootstrap` — returns full initial state
4. Booking APIs — GET list, POST create, GET one, PATCH update
5. Store refactor — swap localStorage for API calls, keep hook interface
6. Master Setup APIs — rooms, inventory, config, special days
7. Venue + Bulk block APIs
8. Credit note APIs
9. Guest notes API
10. Auth middleware — protect all non-auth routes
11. Remove localStorage — strip persist/hydrate logic from store.tsx

Each step is independently deployable. Steps 1–5 are the backbone; 6–11 are additive.

---

## Files to Change (summary)

| File | Change |
|---|---|
| `src/lib/schema.ts` | Add 14 new table definitions |
| `src/lib/store.tsx` | Replace localStorage with API calls |
| `src/middleware.ts` | Add JWT auth guard for all API routes |
| `src/app/api/bootstrap/route.ts` | New — aggregate data fetch |
| `src/app/api/bookings/...` | New — CRUD |
| `src/app/api/master/...` | New — master setup |
| `src/app/api/venues/...` | New |
| `src/app/api/venue-blocks/...` | New |
| `src/app/api/bulk-blocks/...` | New |
| `src/app/api/credit-notes/...` | New |
| `src/app/api/guest-notes/...` | New |
| `scripts/seed.ts` | New — seed all default data |
