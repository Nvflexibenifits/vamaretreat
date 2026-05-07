"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

function isB2CActive(pathname: string): boolean {
  return pathname === "/bookings" || /^\/bookings\/(?!new$).+/.test(pathname);
}

function isSimpleActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useApp();

  const [bookingsOpen, setBookingsOpen] = useState<boolean>(
    pathname.startsWith("/bookings")
  );

  useEffect(() => {
    if (pathname.startsWith("/bookings")) setBookingsOpen(true);
  }, [pathname]);

  const onLogout = () => {
    logout();
    router.replace("/login");
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
        <Link
          href="/"
          className={`nav-it${isSimpleActive(pathname, "/") ? " active" : ""}`}
        >
          <span className="nav-icon">⌂</span> Home
        </Link>

        <button
          type="button"
          className={`nav-it${bookingsOpen ? " active" : ""}`}
          onClick={() => setBookingsOpen((v) => !v)}
          style={{ background: "transparent", border: "none", width: "100%", textAlign: "left" }}
        >
          <span className="nav-icon">📋</span>
          Bookings
          <span className={`nav-arrow${bookingsOpen ? " open" : ""}`}>▸</span>
        </button>

        {bookingsOpen && (
          <div className="nav-children">
            <Link
              href="/bookings"
              className={`nav-it child${isB2CActive(pathname) ? " active" : ""}`}
            >
              B2C Bookings
            </Link>
            <span className="nav-it child soon">
              Group Bookings
              <span className="nav-soon">Coming Soon</span>
            </span>
            <span className="nav-it child soon">
              Corporate Bookings
              <span className="nav-soon">Coming Soon</span>
            </span>
            <span className="nav-it child soon">
              School Bookings
              <span className="nav-soon">Coming Soon</span>
            </span>
            <span className="nav-it child soon">
              Institute Bookings
              <span className="nav-soon">Coming Soon</span>
            </span>
          </div>
        )}

        <Link
          href="/room-chart"
          className={`nav-it${isSimpleActive(pathname, "/room-chart") ? " active" : ""}`}
        >
          <span className="nav-icon">🏡</span> Room Chart
        </Link>

        <Link
          href="/revenue"
          className={`nav-it${isSimpleActive(pathname, "/revenue") ? " active" : ""}`}
        >
          <span className="nav-icon">₹</span> Revenue
        </Link>

        <span className="nav-it soon">
          <span className="nav-icon">📊</span> Reports
          <span className="nav-soon">Coming Soon</span>
        </span>

        <span className="nav-it soon">
          <span className="nav-icon">⚙</span> Master Setup
          <span className="nav-soon">Coming Soon</span>
        </span>
      </nav>
      <div className="sb-ft">
        <button type="button" className="sb-logout-btn" onClick={onLogout}>
          ⏏ Logout
        </button>
      </div>
    </div>
  );
}
