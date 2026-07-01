import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { creditNotes } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;

  try {
    const body = await req.json();

    const existing = await db
      .select()
      .from(creditNotes)
      .where(eq(creditNotes.code, code))
      .then((rows) => rows[0] ?? null);

    if (!existing) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    const mergedData = { ...(existing.data as object), ...body };

    const [updated] = await db
      .update(creditNotes)
      .set({ data: mergedData })
      .where(eq(creditNotes.code, code))
      .returning();

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("[PATCH /api/app/credit-notes/[code]]", err);
    return NextResponse.json({ error: "Failed to update credit note" }, { status: 500 });
  }
}
