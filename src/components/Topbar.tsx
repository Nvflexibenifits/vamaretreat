"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { formatLongDate } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/": "Home",
  "/bookings": "B2C Bookings",
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
  const router = useRouter();
  const { logout } = useApp();
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    setDateStr(formatLongDate());
  }, []);

  const onLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div id="topbar">
      <div className="topbar-title">{getTitle(pathname)}</div>
      <div className="topbar-right">
        <div className="topbar-date">{dateStr}</div>
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
