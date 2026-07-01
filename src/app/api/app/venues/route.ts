import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { venues } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// POST /api/app/venues — upsert a full venue object
export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const [row] = await db
      .insert(venues)
      .values({ id: body.id, data: body })
      .onConflictDoUpdate({
        target: venues.id,
        set: { data: sql`excluded.data` },
      })
      .returning();

    return NextResponse.json(row, { status: 200 });
  } catch (err) {
    console.error("[POST /api/app/venues]", err);
    return NextResponse.json({ error: "Failed to save venue" }, { status: 500 });
  }
}
