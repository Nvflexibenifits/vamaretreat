import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { roomInventory } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// POST /api/app/room-inventory — upsert a single room inventory item
export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as { id: string; [key: string]: unknown };

    await db
      .insert(roomInventory)
      .values({ id: body.id, data: body })
      .onConflictDoUpdate({
        target: roomInventory.id,
        set: { data: sql`excluded.data` },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/app/room-inventory]", err);
    return NextResponse.json({ error: "Failed to upsert room inventory" }, { status: 500 });
  }
}
