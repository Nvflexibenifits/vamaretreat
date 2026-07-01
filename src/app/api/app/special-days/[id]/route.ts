import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { specialDays } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/api-auth";

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
    await db.delete(specialDays).where(eq(specialDays.id, id));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/app/special-days/[id]]", err);
    return NextResponse.json({ error: "Failed to delete special day" }, { status: 500 });
  }
}
