import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appSettings,
  b2bBookings,
  bookings,
  bulkRoomBlocks,
  creditNotes,
  roomInventory,
  rooms,
  specialDays,
  syncDeletions,
  venueBlocks,
  venues,
} from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// Writes commit with the timestamp of their transaction start, so a write in
// flight while the previous poll ran can carry a timestamp slightly older
// than that poll's cursor. Re-reading a few seconds of overlap costs almost
// nothing and applying the same row twice is harmless.
const OVERLAP_SECONDS = 5;

// GET /api/app/changes?since=<cursor from /api/app/state or a previous call>
//
// Returns only rows changed after the cursor, plus ids deleted since then, so
// a tab polling every 30 seconds moves a few hundred bytes instead of the
// whole database. The response carries the next cursor.
export async function GET(req: NextRequest) {
  if (!getSessionUserId(req)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const sinceParam = req.nextUrl.searchParams.get("since") ?? "";
  if (!sinceParam || Number.isNaN(Date.parse(sinceParam))) {
    return NextResponse.json({ error: "Missing or invalid since" }, { status: 400 });
  }
  const since = new Date(Date.parse(sinceParam) - OVERLAP_SECONDS * 1000).toISOString();

  try {
    const cursorRows = (await db.execute(sql`select now()::text as now`)).rows as { now: string }[];
    const cursor = cursorRows[0]?.now;
    // updated_at is trigger-maintained and not part of the Drizzle table
    // definitions, so it is referenced as raw SQL.
    const changedSince = sql`updated_at > ${since}::timestamptz`;

    const [
      bookingRows,
      b2bBookingRows,
      roomRows,
      roomInventoryRows,
      venueRows,
      venueBlockRows,
      bulkRoomBlockRows,
      specialDayRows,
      creditNoteRows,
      settingsRows,
      deletionRows,
    ] = await Promise.all([
      db.select({ data: bookings.data }).from(bookings).where(changedSince),
      db.select({ data: b2bBookings.data }).from(b2bBookings).where(changedSince),
      db.select({ data: rooms.data }).from(rooms).where(changedSince),
      db.select({ data: roomInventory.data }).from(roomInventory).where(changedSince),
      db.select({ data: venues.data }).from(venues).where(changedSince),
      db.select({ data: venueBlocks.data }).from(venueBlocks).where(changedSince),
      db.select({ data: bulkRoomBlocks.data }).from(bulkRoomBlocks).where(changedSince),
      db.select({ data: specialDays.data }).from(specialDays).where(changedSince),
      db.select({ data: creditNotes.data }).from(creditNotes).where(changedSince),
      db.select({ id: appSettings.id, data: appSettings.data }).from(appSettings).where(changedSince),
      db
        .select({ tableName: syncDeletions.tableName, rowId: syncDeletions.rowId })
        .from(syncDeletions)
        .where(sql`deleted_at > ${since}::timestamptz`),
    ]);

    const deleted: Record<string, string[]> = {};
    deletionRows.forEach((d) => {
      (deleted[d.tableName] ??= []).push(d.rowId);
    });

    const settingsRow = settingsRows.find((r) => r.id === "main");
    const changed =
      bookingRows.length + b2bBookingRows.length + roomRows.length + roomInventoryRows.length +
      venueRows.length + venueBlockRows.length + bulkRoomBlockRows.length + specialDayRows.length +
      creditNoteRows.length + deletionRows.length > 0 || !!settingsRow;

    return NextResponse.json({
      cursor,
      changed,
      bookings: bookingRows.map((r) => r.data),
      b2bBookings: b2bBookingRows.map((r) => r.data),
      rooms: roomRows.map((r) => r.data),
      roomInventory: roomInventoryRows.map((r) => r.data),
      venues: venueRows.map((r) => r.data),
      venueBlocks: venueBlockRows.map((r) => r.data),
      bulkRoomBlocks: bulkRoomBlockRows.map((r) => r.data),
      specialDays: specialDayRows.map((r) => r.data),
      creditNotes: creditNoteRows.map((r) => r.data),
      settings: settingsRow ? settingsRow.data : null,
      deleted,
    });
  } catch (err) {
    console.error("[GET /api/app/changes]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
