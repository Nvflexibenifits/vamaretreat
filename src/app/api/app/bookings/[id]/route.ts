import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// PATCH /api/app/bookings/[id] — merge a partial patch into an existing booking
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!getSessionUserId(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [existing] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const body = await req.json();
    const merged = { ...(existing.data as object), ...body };

    await db
      .update(bookings)
      .set({ data: sql`${JSON.stringify(merged)}::jsonb` })
      .where(eq(bookings.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/app/bookings/:id]", err);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
