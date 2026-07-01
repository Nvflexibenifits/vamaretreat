import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// POST /api/app/bookings — upsert a full booking object
export async function POST(req: NextRequest) {
  if (!getSessionUserId(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    await db
      .insert(bookings)
      .values({ id: body.id, data: body })
      .onConflictDoUpdate({
        target: bookings.id,
        set: { data: sql`excluded.data` },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/app/bookings]", err);
    return NextResponse.json({ error: "Failed to save booking" }, { status: 500 });
  }
}
