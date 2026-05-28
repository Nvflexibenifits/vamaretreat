"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { formatLongDate } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/": "Home",
  "/bookings": "All Bookings",
  "/bookings/new": "New Booking — B2C",
  "/room-chart": "Room Chart",
  "/revenue": "Revenue",
  "/crm": "Guest CRM",
  "/master-setup": "Master Setup",
};

function getTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (/^\/bookings\/[^/]+$/.test(pathname)) return "Booking Detail";
  return "Home";
}

export function Topbar() {
  const pathname = usePathname();
  const { currentRole } = useApp();
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    setDateStr(formatLongDate());
  }, []);

  const showNewBtn = currentRole === "Sales" || currentRole === "Admin";

  return (
    <div id="topbar">
      <div className="topbar-title">{getTitle(pathname)}</div>
      <div className="topbar-right">
        <div className="topbar-date">{dateStr}</div>
        {showNewBtn && (
          <Link href="/bookings/new" className="btn btn-accent btn-sm">
            New Booking
          </Link>
        )}
      </div>
    </div>
  );
}
