import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bulkRoomBlocks } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/api-auth";

// PATCH /api/app/bulk-blocks/[id] — Partial update
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
      .from(bulkRoomBlocks)
      .where(eq(bulkRoomBlocks.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const merged = { ...(existing.data as Record<string, unknown>), ...body };

    await db
      .update(bulkRoomBlocks)
      .set({ data: merged })
      .where(eq(bulkRoomBlocks.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/app/bulk-blocks/:id]", err);
    return NextResponse.json({ error: "Failed to update bulk block" }, { status: 500 });
  }
}

// DELETE /api/app/bulk-blocks/[id] — Delete row
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
      .from(bulkRoomBlocks)
      .where(eq(bulkRoomBlocks.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(bulkRoomBlocks).where(eq(bulkRoomBlocks.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/app/bulk-blocks/:id]", err);
    return NextResponse.json({ error: "Failed to delete bulk block" }, { status: 500 });
  }
}
