import { NextRequest, NextResponse } from "next/server";
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
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const userId = getSessionUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [
      bookingRows,
      roomRows,
      roomInventoryRows,
      venueRows,
      venueBlockRows,
      bulkRoomBlockRows,
      specialDayRows,
      creditNoteRows,
      settingsRows,
    ] = await Promise.all([
      db.select().from(bookings),
      db.select().from(rooms),
      db.select().from(roomInventory),
      db.select().from(venues),
      db.select().from(venueBlocks),
      db.select().from(bulkRoomBlocks),
      db.select().from(specialDays),
      db.select().from(creditNotes),
      db.select().from(appSettings).where(eq(appSettings.id, "main")).limit(1),
    ]);

    const settingsRow = settingsRows[0];
    const settingsData = settingsRow ? (settingsRow.data as Record<string, unknown>) : {};

    return NextResponse.json({
      bookings: bookingRows.map((row) => row.data),
      rooms: roomRows.map((row) => row.data),
      roomInventory: roomInventoryRows.map((row) => row.data),
      venues: venueRows.map((row) => row.data),
      venueBlocks: venueBlockRows.map((row) => row.data),
      bulkRoomBlocks: bulkRoomBlockRows.map((row) => row.data),
      specialDays: specialDayRows.map((row) => row.data),
      creditNotes: creditNoteRows.map((row) => row.data),
      ...settingsData,
    });
  } catch (err) {
    console.error("[GET /api/app/state]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
