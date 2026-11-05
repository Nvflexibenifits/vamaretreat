"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { formatLongDate } from "@/lib/utils";

const TITLES: Record<string, string> = {
  "/": "Home",
  "/bookings": "B2C Bookings",
  "/bookings/new": "New Booking — B2C",
  "/group-bookings": "Group Bookings",
  "/group-bookings/new": "New Booking — Group",
  "/b2b": "B2B Bookings",
  "/b2b/new": "New Booking — B2B",
  "/room-chart": "Room Chart",
  "/revenue": "Revenue",
  "/credit-notes": "Credit Notes",
  "/crm": "Guest CRM",
  "/master-setup": "Master Setup",
  "/reports": "Reports",
  "/reports/payment-pending": "Payment Pending",
  "/reports/payments-received": "Payments Received",
  "/reports/b2c/lost": "B2C Enquiries Lost",
  "/reports/b2c/completed": "B2C Bookings Completed",
  "/reports/b2c/conversion": "B2C Conversion",
  "/reports/b2b/lost": "B2B Enquiries Lost",
  "/reports/b2b/completed": "B2B Bookings Completed",
  "/reports/b2b/conversion": "B2B Conversion",
  "/reports/group/lost": "Group Enquiries Lost",
  "/reports/group/completed": "Group Bookings Completed",
  "/reports/group/conversion": "Group Conversion",
};

function getTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (/^\/bookings\/GRP-[^/]+$/.test(pathname)) return "Group Booking Detail";
  if (/^\/bookings\/[^/]+$/.test(pathname)) return "Booking Detail";
  if (/^\/b2b\/[^/]+$/.test(pathname)) return "B2B Booking Detail";
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
        <button className="btn btn-accent btn-sm" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
