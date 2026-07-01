import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/schema";
import { getSessionUserId } from "@/lib/api-auth";

// PUT /api/app/settings — partial merge into app_settings id='main'
export async function PUT(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json() as Record<string, unknown>;

    // Fetch existing row
    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, "main"))
      .limit(1);

    const existing = rows[0]?.data as Record<string, unknown> | undefined;

    const merged = { ...(existing ?? {}), ...body };

    await db
      .insert(appSettings)
      .values({ id: "main", data: merged })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { data: sql`excluded.data` },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/app/settings]", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
