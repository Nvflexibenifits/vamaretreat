import type { BookingStatus, Role } from "@/types";

export const fmt = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0 || day === 6;
}

export function nightsBetween(checkin: string, checkout: string): number {
  if (!checkin || !checkout || checkout <= checkin) return 1;
  return Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / (1000 * 60 * 60 * 24)
  );
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export function getTimeOfDay(now: Date = new Date()): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export function statusBadgeClass(s: BookingStatus): string {
  const m: Record<BookingStatus, string> = {
    Draft: "bd-draft",
    Confirmed: "bd-confirmed",
    Completed: "bd-completed",
    Lost: "bd-lost",
  };
  return m[s];
}

export function statusBadgeDot(s: BookingStatus): string {
  const dots: Record<BookingStatus, string> = {
    Draft: "○",
    Confirmed: "●",
    Completed: "✓",
    Lost: "✕",
  };
  return dots[s];
}

export function maxDiscountForRole(role: Role): number {
  if (role === "Admin") return 100;
  if (role === "Manager") return 25;
  return 15;
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function nowTime(): string {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function weekRange(dateStr: string = todayStr()): { start: string; end: string } {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export function sevenDaysFrom(dateStr: string): string[] {
  const out: string[] = [];
  const d = new Date(dateStr);
  for (let i = 0; i < 7; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    out.push(next.toISOString().split("T")[0]);
  }
  return out;
}

export function formatLongDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
