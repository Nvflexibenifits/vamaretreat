import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rooms } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// PUT /api/app/rooms — replace entire rooms table with provided array
export async function PUT(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const roomList = body as { id: string; [key: string]: unknown }[];

    await db.delete(rooms);
    if (roomList.length > 0) {
      await db.insert(rooms).values(
        roomList.map((r) => ({ id: r.id, data: r }))
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/app/rooms]", err);
    return NextResponse.json({ error: "Failed to update rooms" }, { status: 500 });
  }
}
