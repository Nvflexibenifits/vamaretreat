import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bulkRoomBlocks } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// POST /api/app/bulk-blocks — Upsert a bulk room block object
export async function POST(req: NextRequest) {
  if (!getSessionUserId(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    await db
      .insert(bulkRoomBlocks)
      .values({ id: body.id, data: body })
      .onConflictDoUpdate({
        target: bulkRoomBlocks.id,
        set: { data: sql`excluded.data` },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/app/bulk-blocks]", err);
    return NextResponse.json({ error: "Failed to save bulk block" }, { status: 500 });
  }
}
