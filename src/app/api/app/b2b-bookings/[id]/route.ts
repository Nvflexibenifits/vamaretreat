import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { b2bBookings } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// PATCH /api/app/b2b-bookings/[id] — merge a partial update into the stored object
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!getSessionUserId(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    const patch = (await req.json()) as Record<string, unknown>;

    const rows = await db.select().from(b2bBookings).where(eq(b2bBookings.id, id)).limit(1);
    const existing = rows[0]?.data as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .update(b2bBookings)
      .set({ data: { ...existing, ...patch } })
      .where(eq(b2bBookings.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/app/b2b-bookings/[id]]", err);
    return NextResponse.json({ error: "Failed to update B2B booking" }, { status: 500 });
  }
}

// DELETE /api/app/b2b-bookings/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!getSessionUserId(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await ctx.params;
    await db.delete(b2bBookings).where(eq(b2bBookings.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/app/b2b-bookings/[id]]", err);
    return NextResponse.json({ error: "Failed to delete B2B booking" }, { status: 500 });
  }
}
