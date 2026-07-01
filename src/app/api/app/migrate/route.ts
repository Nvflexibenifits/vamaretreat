import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bookings,
  rooms,
  roomInventory,
  venues,
  venueBlocks,
  bulkRoomBlocks,
  specialDays,
  creditNotes,
  appSettings,
} from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// POST /api/app/migrate — bulk-import full vama:state:v2 localStorage snapshot into DB
export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    const bodyBookings      = (body.bookings       as Record<string, unknown>[] | undefined) ?? [];
    const bodyRooms         = (body.rooms           as Record<string, unknown>[] | undefined) ?? [];
    const bodyRoomInventory = (body.roomInventory   as Record<string, unknown>[] | undefined) ?? [];
    const bodyVenues        = (body.venues          as Record<string, unknown>[] | undefined) ?? [];
    const bodyVenueBlocks   = (body.venueBlocks     as Record<string, unknown>[] | undefined) ?? [];
    const bodyBulkRoomBlocks= (body.bulkRoomBlocks  as Record<string, unknown>[] | undefined) ?? [];
    const bodySpecialDays   = (body.specialDays     as Record<string, unknown>[] | undefined) ?? [];
    const bodyCreditNotes   = (body.creditNotes     as Record<string, unknown>[] | undefined) ?? [];

    const settingsData = {
      gstSettings:        body.gstSettings,
      cancellationPolicy: body.cancellationPolicy,
      packageRates:       body.packageRates,
      discountCaps:       body.discountCaps,
      creditNoteSettings: body.creditNoteSettings,
      guestNotes:         (body.guestNotes as Record<string, unknown> | undefined) ?? {},
    };

    if (bodyBookings.length > 0)
      await db.insert(bookings).values(bodyBookings.map((b) => ({ id: b.id as string, data: b })))
        .onConflictDoUpdate({ target: bookings.id, set: { data: sql`excluded.data` } });

    if (bodyRooms.length > 0)
      await db.insert(rooms).values(bodyRooms.map((r) => ({ id: r.id as string, data: r })))
        .onConflictDoUpdate({ target: rooms.id, set: { data: sql`excluded.data` } });

    if (bodyRoomInventory.length > 0)
      await db.insert(roomInventory).values(bodyRoomInventory.map((r) => ({ id: r.id as string, data: r })))
        .onConflictDoUpdate({ target: roomInventory.id, set: { data: sql`excluded.data` } });

    if (bodyVenues.length > 0)
      await db.insert(venues).values(bodyVenues.map((v) => ({ id: v.id as string, data: v })))
        .onConflictDoUpdate({ target: venues.id, set: { data: sql`excluded.data` } });

    if (bodyVenueBlocks.length > 0)
      await db.insert(venueBlocks).values(bodyVenueBlocks.map((v) => ({ id: v.id as string, data: v })))
        .onConflictDoUpdate({ target: venueBlocks.id, set: { data: sql`excluded.data` } });

    if (bodyBulkRoomBlocks.length > 0)
      await db.insert(bulkRoomBlocks).values(bodyBulkRoomBlocks.map((b) => ({ id: b.id as string, data: b })))
        .onConflictDoUpdate({ target: bulkRoomBlocks.id, set: { data: sql`excluded.data` } });

    if (bodySpecialDays.length > 0)
      await db.insert(specialDays).values(bodySpecialDays.map((s) => ({ id: s.id as string, data: s })))
        .onConflictDoUpdate({ target: specialDays.id, set: { data: sql`excluded.data` } });

    if (bodyCreditNotes.length > 0)
      await db.insert(creditNotes).values(bodyCreditNotes.map((c) => ({ code: c.code as string, data: c })))
        .onConflictDoUpdate({ target: creditNotes.code, set: { data: sql`excluded.data` } });

    await db.insert(appSettings).values({ id: "main", data: settingsData })
      .onConflictDoUpdate({ target: appSettings.id, set: { data: sql`excluded.data` } });

    return NextResponse.json({
      ok: true,
      migrated: {
        bookings:       bodyBookings.length,
        rooms:          bodyRooms.length,
        roomInventory:  bodyRoomInventory.length,
        venues:         bodyVenues.length,
        venueBlocks:    bodyVenueBlocks.length,
        bulkRoomBlocks: bodyBulkRoomBlocks.length,
        specialDays:    bodySpecialDays.length,
        creditNotes:    bodyCreditNotes.length,
        appSettings:    1,
      },
    });
  } catch (err) {
    console.error("[POST /api/app/migrate]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Migration failed", detail: msg }, { status: 500 });
  }
}
