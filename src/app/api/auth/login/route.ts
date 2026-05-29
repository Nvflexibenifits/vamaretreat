import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email: string; password: string };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), active: true },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 });
    }

    const displayRole = user.role === "FrontOffice" ? "Front Office" : user.role;

    const token = jwt.sign(
      { userId: user.id, name: user.name, role: displayRole, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "8h" }
    );

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, role: displayRole, email: user.email },
    });

    res.cookies.set("vama-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return res;
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
