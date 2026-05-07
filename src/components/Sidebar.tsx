"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";

type NavItem = {
  href: string;
  icon: string;
  label: string;
  badgeKey?: "bookings" | "rooms";
  badgeGreen?: boolean;
};

const MAIN: NavItem[] = [
  { href: "/", icon: "⌂", label: "Dashboard" },
  { href: "/bookings", icon: "📋", label: "All Bookings", badgeKey: "bookings" },
  { href: "/bookings/new", icon: "＋", label: "New Booking" },
];

const OPS: NavItem[] = [
  { href: "/room-chart", icon: "🏡", label: "Room Chart", badgeKey: "rooms", badgeGreen: true },
  { href: "/revenue", icon: "₹", label: "Revenue" },
  { href: "/crm", icon: "👥", label: "Guest CRM" },
];

const SYSTEM: NavItem[] = [
  { href: "/settings", icon: "⚙", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/bookings") return pathname === "/bookings" || /^\/bookings\/(?!new$)/.test(pathname);
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentRole, currentUser, bookings, logout } = useApp();

  const openCount = bookings.filter(
    (b) => b.status === "Draft" || b.status === "Confirmed"
  ).length;
  const unallocCount = bookings.filter(
    (b) => b.status === "Confirmed" && !b.allocatedRoom
  ).length;

  const hideNew =
    currentRole === "Room Allocator";
  const hideSettings =
    currentRole === "Room Allocator" || currentRole === "Sales REX";

  const onLogout = () => {
    logout();
    router.replace("/login");
  };

  const renderItem = (item: NavItem) => {
    if (item.label === "New Booking" && hideNew) return null;
    if (item.label === "Settings" && hideSettings) return null;
    const active = isActive(pathname, item.href);
    let badge: number | null = null;
    if (item.badgeKey === "bookings") badge = openCount;
    else if (item.badgeKey === "rooms") badge = unallocCount;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`nav-it${active ? " active" : ""}`}
      >
        <span className="nav-icon">{item.icon}</span>
        {item.label}
        {item.badgeKey === "rooms" ? (
          <span className={`nav-badge grn${badge ? "" : " hide"}`}>{badge}</span>
        ) : item.badgeKey === "bookings" ? (
          <span className="nav-badge">{badge}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <div id="sidebar">
      <div className="sb-hd">
        <div className="sb-logo">
          <div className="sb-mark">VR</div>
          <div>
            <div className="sb-brand">Vama Retreats</div>
            <div className="sb-brand-sub">Back Office</div>
          </div>
        </div>
      </div>
      <nav className="sb-nav">
        <div className="sb-sec">Main</div>
        {MAIN.map(renderItem)}
        <div className="sb-sec">Operations</div>
        {OPS.map(renderItem)}
        {!hideSettings && (
          <>
            <div className="sb-sec">System</div>
            {SYSTEM.map(renderItem)}
          </>
        )}
      </nav>
      <div className="sb-ft">
        <div className="sb-user">
          <div className="sb-av">{currentUser[0]}</div>
          <div>
            <div className="sb-uname">{currentUser}</div>
            <div className="sb-urole">{currentRole}</div>
          </div>
          <button className="sb-logout" onClick={onLogout} title="Sign out">⏏</button>
        </div>
      </div>
    </div>
  );
}
