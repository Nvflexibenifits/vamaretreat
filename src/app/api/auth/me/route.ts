import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("vama-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let payload: { userId: string };
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    } catch {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [user] = await db
      .select({ id: users.id, name: users.name, role: users.role, email: users.email, active: users.active })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || !user.active) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
