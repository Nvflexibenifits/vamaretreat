import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

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

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const plainPwd = password?.trim() || undefined;
    const hashedPassword = plainPwd ? await bcrypt.hash(plainPwd, 10) : undefined;

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.trim().toLowerCase();
    if (role) updateData.role = role;
    if (color) updateData.color = color;
    if (typeof active === "boolean") updateData.active = active;
    if (hashedPassword) updateData.password = hashedPassword;
    if (plainPwd) updateData.plainPassword = plainPwd;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({ id: users.id, name: users.name, role: users.role, email: users.email, color: users.color, active: users.active, plainPassword: users.plainPassword });

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
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.delete(users).where(eq(users.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/users]", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
