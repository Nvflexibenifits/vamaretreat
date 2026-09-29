# Room Nights

Stage 2 of the room allocation plan for the Vama Retreats back office. Written 29 Sep 2026.

## The job

One table records where every guest sleeps every night. The database refuses two guests in one villa on one night. Every screen reads that table and nothing else. This removes the entire class of "stale villa" bugs and makes a double booking impossible, including from two devices saving at the same second.

Out of scope: choosing villas on the server (stage 4), room locks (stage 5, the column is added now), venue blocks (venues are not rooms and stay as they are), dayouts (no night is sold).

## Why the current model fails

Where a guest sleeps is held in two places on the booking record: the allocation, one villa per segment, and a list of per-night moves on top of it, which also carries upgrades. Every consumer has to combine the two. Four did it wrong at different times: the allocator, the room chart, the meal tabs, and the edit save. Availability is checked in the browser only, so nothing stops two tabs allocating the same villa.

## The new model

A table `room_nights`, one row per villa per night held.

| Column | Type | Meaning |
|---|---|---|
| id | text, primary key | Generated |
| holder_kind | text | b2c, or block for group and maintenance holds |
| holder_id | text | The booking id or bulk block id |
| segment_id | text, nullable | The booking segment the night belongs to |
| date | date | The night, check-in date of that night |
| room_id | text | Physical villa, references room inventory |
| category_booked | text | Category the guest paid for, so an upgrade is visible |
| upgrade | jsonb, nullable | kind, from and to category, by, at. Present only on upgraded nights |
| locked | boolean, default false | Reserved for stage 5 |
| source | text | auto, drag, upgrade, manual, migration |
| by | text | Staff name |
| created_at, updated_at | timestamptz | updated_at trigger-maintained like the other tables |

Rules enforced by the database:

- Unique on (room_id, date). The second insert for the same villa and night fails.
- room_id must exist in room inventory.
- Cancelled and Lost bookings have no rows. Cancel and mark-lost delete them, which frees the villas.
- The table joins delta sync: updated_at trigger, deletion log, and the changes endpoint, so the chart on every device updates within 30 seconds.

The booking record stops carrying allocatedRooms, nightOverrides, and per-segment allocatedRooms. They are derived from room_nights. Bulk room blocks stop carrying room ids per row for the same reason.

## Migration

One script, run against a copy first, then production during a freeze.

1. For each Confirmed, Tentative or Completed booking, each segment, each night, each allocated villa: insert a row. If a move exists for that villa and night, the row's room_id is the destination, source is drag or upgrade, and the upgrade details are copied. Otherwise source is migration.
2. For each bulk block, each night, each villa: insert a block row.
3. Before adding the uniqueness rule, list every (room_id, date) with more than one row. Today's data shows none that are real, but the list goes to staff to confirm.
4. Add the constraint.
5. Old fields stay on the booking JSON untouched for two weeks as a fallback, then a second script strips them.

Rehearse on the local copy at vama_delta_test, which already mirrors production.

## Write paths

All writes go through the API inside one transaction. A uniqueness failure returns 409 with the villa, the date, and who holds it, and the screen shows exactly that.

| Action | Endpoint | Effect |
|---|---|---|
| Save booking, confirm | PUT /api/app/room-nights/booking/:id | Replace the booking's rows with the set the client computed. Rows unchanged in villa and date keep their upgrade and source. |
| Move a night | PATCH /api/app/room-nights/move | Update room_id on the given rows, set source drag or upgrade, record by. |
| Cancel, mark lost | existing routes | Delete the booking's rows. |
| Bulk block save | PUT /api/app/room-nights/block/:id | Replace the block's rows. |

The client still chooses villas in stage 2. It keeps the rule from stage 1: hold what already works, night by night, and only pick new villas for nights that cannot be honoured. Stage 4 moves that choice into the server.

## Consumers to switch

Every reader of allocatedRooms and nightOverrides changes to one selector: rows for a booking, or rows for a date. In the codebase today:

- `src/lib/utils.ts`: findAvailableRoomIds, tryAssignRooms, roomsHeldOnDate, effectiveRoomsOnDate, currentAllocation, pruneNightOverrides. The last four go away.
- `src/app/(dashboard)/room-chart/page.tsx`: cell map, conflict marker, drag checks, upgrade flow.
- `src/app/(dashboard)/page.tsx`: front office tabs, availability grid.
- `src/app/(dashboard)/bookings/[id]/page.tsx`: room display, confirm, book tentative.
- `src/components/BookingForm.tsx`: save paths.
- `src/lib/store.tsx`: the new collection, delta merge, cancel and lost paths.
- `src/app/api/app/state/route.ts` and `changes/route.ts`: include the collection.

## Acceptance

Each of these must hold before the constraint goes live on production:

1. Two tabs save two new bookings for the last free villa within the same second. One succeeds, the other shows the villa and who has it.
2. Drag a guest onto a villa held by someone else. Refused with the holder named.
3. Upgrade a guest, let the vacated villa be resold, then edit and save the upgraded booking. Nothing moves.
4. Move a guest for one night of three. The other two nights stay in the original villa. The meal tab shows the right villa on each date.
5. Cancel a booking. Its villas are free the same minute on another device.
6. Run the migration twice. Second run changes nothing.
7. Conflict list on the chart and the pre-constraint report agree.

## Effort

| Piece | Days |
|---|---|
| Table, triggers, migration script, rehearsal | 1.5 |
| API write paths with transactions and 409 handling | 1 |
| Switch consumers and remove old fields | 2 |
| Acceptance run on the copy, cutover evening | 0.5 |

About a week. One deploy, one evening freeze of roughly an hour.

## Decisions needed

- Cutover date and freeze window. Staff must not create or move bookings during it.
- Whether the old JSON fields are stripped after two weeks or kept longer.
- Whether maintenance holds should show a reason on the chart hover once they live in the same table. Cheap to add now.
