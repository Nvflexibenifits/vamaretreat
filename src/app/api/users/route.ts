import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

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
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        color: true,
        active: true,
      },
    });
    return NextResponse.json(
      users.map((u) => ({ ...u, role: u.role === "FrontOffice" ? "Front Office" : u.role }))
    );
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

    const dbUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashed,
        role: role as never,
        color: color || "#172f24",
        active: true,
      },
    });

    return NextResponse.json(
      { id: dbUser.id, name: dbUser.name, role: dbUser.role, email: dbUser.email, color: dbUser.color, active: dbUser.active },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/users]", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
