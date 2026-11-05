import type { B2BBooking, B2BType, Booking, OtaProvider } from "@/types";
import { OTA_PROVIDERS } from "@/types";
import { nightsBetween } from "@/lib/utils";

// ─────── Shared filter model for the Reports section ───────
// Segment picks the business line; `sub` narrows it to an OTA provider or a
// B2B type. Dates are inclusive and empty means open-ended.
export type Segment = "all" | "b2c-direct" | "b2c-ota" | "group" | "b2b";
export type ReportFilter = { segment: Segment; sub: string; from: string; to: string };

export const B2B_TYPES: B2BType[] = ["Corporate", "School", "Institute"];

// Which team a report belongs to. B2C, B2B and Group are three separate
// sections, each with its own copy of every report so no team wades through
// another's data. Group bookings share the B2C table but are their own line.
export type Line = "b2c" | "b2b" | "group";
export const LINE_LABEL: Record<Line, string> = { b2c: "B2C", b2b: "B2B", group: "Group" };

export function emptyFilter(from = "", to = ""): ReportFilter {
  return { segment: "all", sub: "", from, to };
}

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_SHORT[Number(m) - 1] ?? m} ${y}`;
}

// Inclusive first-to-last day of a "YYYY-MM" month
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}

// Months offered by the filter bar: six ahead back to three years ago,
// newest first, so the current month is near the top.
export function monthOptions(today: string): { value: string; label: string }[] {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  const out: { value: string; label: string }[] = [];
  for (let i = 6; i >= -36; i--) {
    const d = new Date(y, m - 1 + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: ym, label: monthLabel(ym) });
  }
  return out;
}

// Segment choices for the filter bar, cut down to one team's lines when a
// report belongs to a section. Group bookings are always direct, so that
// section has a single choice and its reports hide the picker.
export function segmentOptions(line: Line | "all"): { value: string; label: string }[] {
  const b2c = [
    { value: "b2c-direct:", label: "B2C · Direct" },
    { value: "b2c-ota:", label: "B2C · OTA (all)" },
    ...OTA_PROVIDERS.map((p) => ({ value: `b2c-ota:${p.id}`, label: `B2C · OTA · ${p.name}` })),
  ];
  if (line === "b2c") return [{ value: "all:", label: "All B2C" }, ...b2c];
  if (line === "b2b") return [{ value: "all:", label: "All B2B" }, ...B2B_TYPES.map((t) => ({ value: `b2b:${t}`, label: t }))];
  if (line === "group") return [{ value: "all:", label: "All Group" }];
  return [
    { value: "all:", label: "All" },
    ...b2c,
    { value: "group:", label: "Group" },
    { value: "b2b:", label: "B2B (all)" },
    ...B2B_TYPES.map((t) => ({ value: `b2b:${t}`, label: `B2B · ${t}` })),
  ];
}

// Guest counts the marketing reports mine: campaign targets are families
// with kids or pets. Kids under 10 folds in the 6-10, 2-6 and infant bands.
export type PaxBreakdown = { adults: number; seniors: number; under10: number; over10: number; pets: number };

export function paxBreakdown(b: Booking): PaxBreakdown {
  return {
    adults: b.adults || 0,
    seniors: b.seniors || 0,
    under10: (b.kids6to10 || 0) + (b.kids2to6 || 0) + (b.infantsBelow2 || 0),
    over10: b.kidsAbove10 || 0,
    pets: b.pets || 0,
  };
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
  // Group bookings share the B2C table but are their own business line
  if (b.kind === "group") return { segment: "group", sub: "", label: "Group" };
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
