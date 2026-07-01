import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { venueBlocks } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// POST /api/app/venue-blocks — upsert a full venue block object
export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const [row] = await db
      .insert(venueBlocks)
      .values({ id: body.id, data: body })
      .onConflictDoUpdate({
        target: venueBlocks.id,
        set: { data: sql`excluded.data` },
      })
      .returning();

    return NextResponse.json(row, { status: 200 });
  } catch (err) {
    console.error("[POST /api/app/venue-blocks]", err);
    return NextResponse.json({ error: "Failed to save venue block" }, { status: 500 });
  }
}
