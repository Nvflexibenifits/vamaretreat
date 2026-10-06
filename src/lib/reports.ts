import type { B2BBooking, B2BType, Booking, OtaProvider } from "@/types";
import { OTA_PROVIDERS } from "@/types";
import { addDays, nightsBetween } from "@/lib/utils";

// ─────── Shared filter model for the Reports section ───────
// Segment picks the business line; `sub` narrows it to an OTA provider or a
// B2B type. Dates are inclusive and empty means open-ended.
export type Segment = "all" | "b2c-direct" | "b2c-ota" | "b2b";
export type ReportFilter = { segment: Segment; sub: string; from: string; to: string };

export const B2B_TYPES: B2BType[] = ["Corporate", "School", "Institute"];

export function emptyFilter(from = "", to = ""): ReportFilter {
  return { segment: "all", sub: "", from, to };
}

export function shortcutRange(kind: "today" | "week" | "month", today: string): { from: string; to: string } {
  if (kind === "today") return { from: today, to: today };
  const d = new Date(today + "T00:00:00");
  if (kind === "week") {
    const day = (d.getDay() + 6) % 7; // Monday = 0
    const from = addDays(today, -day);
    return { from, to: addDays(from, 6) };
  }
  const from = `${today.slice(0, 7)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from, to: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}` };
}

export function inRange(f: ReportFilter, date: string): boolean {
  if (!date) return !f.from && !f.to;
  if (f.from && date < f.from) return false;
  if (f.to && date > f.to) return false;
  return true;
}

// Where a row sits in the segment tree, plus its display label.
export type SegmentInfo = { segment: Exclude<Segment, "all">; sub: string; label: string };

export function b2cSegment(b: Booking): SegmentInfo {
  if (b.source === "OTA") {
    const prov = OTA_PROVIDERS.find((p) => p.id === b.otaProvider);
    return { segment: "b2c-ota", sub: b.otaProvider ?? "", label: `B2C · OTA${prov ? ` · ${prov.name}` : ""}` };
  }
  return { segment: "b2c-direct", sub: "", label: "B2C · Direct" };
}

export function b2bSegment(b: B2BBooking): SegmentInfo {
  return { segment: "b2b", sub: b.type, label: `B2B · ${b.type}` };
}

export function matchesSegment(f: ReportFilter, info: SegmentInfo): boolean {
  if (f.segment === "all") return true;
  if (f.segment !== info.segment) return false;
  if (!f.sub) return true;
  return info.sub === f.sub;
}

export function providerName(id?: OtaProvider | string): string {
  return OTA_PROVIDERS.find((p) => p.id === id)?.name ?? (id || "");
}

// Villas wanted on a B2C booking, e.g. "1 BHK Villa x2, Couple Room x1"
export function roomsWanted(b: Booking): string {
  const need = new Map<string, number>();
  (b.segments ?? []).forEach((s) =>
    s.rooms.forEach((r) => need.set(r.roomName || r.roomId, Math.max(need.get(r.roomName || r.roomId) ?? 0, r.numRooms)))
  );
  return [...need.entries()].map(([n, c]) => `${n} x${c}`).join(", ");
}

export function stayNights(checkin: string, checkout: string): number {
  return checkin && checkout && checkout > checkin ? nightsBetween(checkin, checkout) : 0;
}

// Same CSV shape the Revenue Register exports: BOM for Excel, quoted cells.
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows]
    .map((cols) => cols.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function csvName(report: string, f: ReportFilter): string {
  const span = f.from || f.to ? `_${f.from || "start"}_to_${f.to || "end"}` : "_all";
  const seg = f.segment === "all" ? "" : `_${f.segment}${f.sub ? `-${f.sub}` : ""}`;
  return `${report}${seg}${span}.csv`;
}
