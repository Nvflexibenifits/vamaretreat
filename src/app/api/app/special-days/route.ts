import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { specialDays } from "@/lib/schema";
import { sql } from "drizzle-orm";
import { getSessionUserId } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const [row] = await db
      .insert(specialDays)
      .values({ id: body.id, data: body })
      .onConflictDoUpdate({
        target: specialDays.id,
        set: { data: sql`excluded.data` },
      })
      .returning();

    return NextResponse.json(row, { status: 200 });
  } catch (err) {
    console.error("[POST /api/app/special-days]", err);
    return NextResponse.json({ error: "Failed to save special day" }, { status: 500 });
  }
}
