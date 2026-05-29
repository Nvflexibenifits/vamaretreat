import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, role: true, email: true, active: true },
    });

    if (!user || !user.active) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({
      user: { ...user, role: user.role === "FrontOffice" ? "Front Office" : user.role },
    });
  } catch (err) {
    console.error("[GET /api/auth/me]", err);
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
