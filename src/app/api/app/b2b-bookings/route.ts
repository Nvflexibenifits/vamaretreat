import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { b2bBookings } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// POST /api/app/b2b-bookings — upsert a full B2B booking object
export async function POST(req: NextRequest) {
  if (!getSessionUserId(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    await db
      .insert(b2bBookings)
      .values({ id: body.id, data: body })
      .onConflictDoUpdate({
        target: b2bBookings.id,
        set: { data: sql`excluded.data` },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/app/b2b-bookings]", err);
    return NextResponse.json({ error: "Failed to save B2B booking" }, { status: 500 });
  }
}
