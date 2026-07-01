import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { venues } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// PATCH /api/app/venues/[id] — Partial update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();

    const [existing] = await db
      .select()
      .from(venues)
      .where(eq(venues.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const merged = { ...(existing.data as Record<string, unknown>), ...body };

    await db
      .update(venues)
      .set({ data: merged })
      .where(eq(venues.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/app/venues/:id]", err);
    return NextResponse.json({ error: "Failed to update venue" }, { status: 500 });
  }
}

// DELETE /api/app/venues/[id] — Delete row
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [existing] = await db
      .select()
      .from(venues)
      .where(eq(venues.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(venues).where(eq(venues.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/app/venues/:id]", err);
    return NextResponse.json({ error: "Failed to delete venue" }, { status: 500 });
  }
}
