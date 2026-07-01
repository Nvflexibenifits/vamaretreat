import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditNotes } from "@/lib/schema";
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
      .insert(creditNotes)
      .values({ code: body.code, data: body })
      .onConflictDoUpdate({
        target: creditNotes.code,
        set: { data: sql`excluded.data` },
      })
      .returning();

    return NextResponse.json(row, { status: 200 });
  } catch (err) {
    console.error("[POST /api/app/credit-notes]", err);
    return NextResponse.json({ error: "Failed to save credit note" }, { status: 500 });
  }
}
