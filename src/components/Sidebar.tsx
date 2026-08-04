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
  const { logout, currentRole, currentUser } = useApp();

  const [bookingsOpen, setBookingsOpen] = useState<boolean>(
    pathname.startsWith("/bookings")
  );

  useEffect(() => {
    if (pathname.startsWith("/bookings")) setBookingsOpen(true);
  }, [pathname]);

  const onLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    logout();
    router.push("/login");
  };

  const isFrontOffice = currentRole === "Front Office";
  const isAdmin = currentRole === "Admin";

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
          Home
        </Link>

        {!isFrontOffice && (
          <>
            <button
              type="button"
              className={`nav-it${bookingsOpen ? " active" : ""}`}
              onClick={() => setBookingsOpen((v) => !v)}
              style={{ background: "transparent", border: "none", width: "100%", textAlign: "left" }}
            >
              Bookings
              <span className={`nav-arrow${bookingsOpen ? " open" : ""}`}>{bookingsOpen ? "-" : "+"}</span>
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
          </>
        )}

        <Link
          href="/room-chart"
          className={`nav-it${isSimpleActive(pathname, "/room-chart") ? " active" : ""}`}
        >
          Room Chart
        </Link>

        {!isFrontOffice && (
          <>
            <Link
              href="/revenue"
              className={`nav-it${isSimpleActive(pathname, "/revenue") ? " active" : ""}`}
            >
              Revenue
            </Link>

            <Link
              href="/credit-notes"
              className={`nav-it${isSimpleActive(pathname, "/credit-notes") ? " active" : ""}`}
            >
              Credit Notes
            </Link>

            <span className="nav-it soon">
              Reports
              <span className="nav-soon">Coming Soon</span>
            </span>

            {isAdmin && (
              <Link
                href="/master-setup"
                className={`nav-it${isSimpleActive(pathname, "/master-setup") ? " active" : ""}`}
              >
                Master Setup
              </Link>
            )}
          </>
        )}
      </nav>
      <div className="sb-ft">
        <div style={{ fontSize: 11, color: "var(--t3)", paddingLeft: 12 }}>
          {currentUser} · {currentRole}
        </div>
      </div>
    </div>
  );
}
