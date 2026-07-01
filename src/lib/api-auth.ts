import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export function getSessionUserId(req: NextRequest): string | null {
  try {
    const token = req.cookies.get("vama-session")?.value;
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return payload.userId ?? null;
  } catch {
    return null;
  }
}
