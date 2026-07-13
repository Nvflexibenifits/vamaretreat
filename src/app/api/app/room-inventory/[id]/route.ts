import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roomInventory } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/api-auth";

// PATCH /api/app/room-inventory/[id] — Partial update
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
      .from(roomInventory)
      .where(eq(roomInventory.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const merged = { ...(existing.data as Record<string, unknown>), ...body };

    // Renames change the item's id — the row key must move with it, otherwise
    // every later update targets a key that no longer matches the visible id.
    const newId =
      typeof body.id === "string" && body.id.trim() && body.id !== id
        ? (body.id as string)
        : id;
    if (newId !== id) {
      const [clash] = await db
        .select()
        .from(roomInventory)
        .where(eq(roomInventory.id, newId))
        .limit(1);
      if (clash) {
        return NextResponse.json(
          { error: `A room with id ${newId} already exists` },
          { status: 409 }
        );
      }
    }

    await db
      .update(roomInventory)
      .set({ id: newId, data: merged })
      .where(eq(roomInventory.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/app/room-inventory/:id]", err);
    return NextResponse.json({ error: "Failed to update room inventory" }, { status: 500 });
  }
}

// DELETE /api/app/room-inventory/[id] — Delete row
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
      .from(roomInventory)
      .where(eq(roomInventory.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(roomInventory).where(eq(roomInventory.id, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/app/room-inventory/:id]", err);
    return NextResponse.json({ error: "Failed to delete room inventory" }, { status: 500 });
  }
}
