import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { asc } from "drizzle-orm";

function getSession(req: NextRequest): { userId: string } | null {
  const token = req.cookies.get("vama-session")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
  } catch {
    return null;
  }
}

// GET /api/users — public (login page needs this before auth)
export async function GET() {
  try {
    const result = await db
      .select({ id: users.id, name: users.name, role: users.role, email: users.email, color: users.color, active: users.active })
      .from(users)
      .orderBy(asc(users.name));

    return NextResponse.json(result.filter((u) => u.active));
  } catch (err) {
    console.error("[GET /api/users]", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/users — Admin only
export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, email, password, role, color } = body as {
      name: string;
      email: string;
      password: string;
      role: string;
      color: string;
    };

    if (!name?.trim() || !email?.trim() || !password?.trim() || !role) {
      return NextResponse.json({ error: "name, email, password and role are required" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);

    const [created] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role,
        color: color || "#172f24",
        active: true,
      })
      .returning({ id: users.id, name: users.name, role: users.role, email: users.email, color: users.color, active: users.active });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
