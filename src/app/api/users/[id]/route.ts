import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
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

// PATCH /api/users/[id] — Update user
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, email, role, color, active, password } = body as {
      name?: string;
      email?: string;
      role?: string;
      color?: string;
      active?: boolean;
      password?: string;
    };

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hashedPassword = password?.trim() ? await bcrypt.hash(password.trim(), 10) : undefined;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(email && { email: email.trim().toLowerCase() }),
        ...(role && { role: role as never }),
        ...(color && { color }),
        ...(typeof active === "boolean" && { active }),
        ...(hashedPassword && { password: hashedPassword }),
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        color: true,
        active: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/users]", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE /api/users/[id] — Delete user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/users]", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
