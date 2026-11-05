"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/store";

// Group bookings share the /bookings/[id] detail page; their IDs start with
// GRP- so the sidebar can still light up the right entry.
function isGroupActive(pathname: string): boolean {
  return pathname.startsWith("/group-bookings") || /^\/bookings\/GRP-/.test(pathname);
}

function isB2CActive(pathname: string): boolean {
  if (isGroupActive(pathname)) return false;
  return pathname === "/bookings" || /^\/bookings\/(?!new$).+/.test(pathname);
}

function isSimpleActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// Each line of business gets one section holding its list and its reports,
// so B2C, B2B and Group staff never wade through each other's data. Finance
// keeps its own reports under Reports.
const inGroup = (p: string) => isGroupActive(p) || p.startsWith("/reports/group");
const inB2C = (p: string) => !inGroup(p) && (p.startsWith("/bookings") || p.startsWith("/reports/b2c"));
const inB2B = (p: string) => p.startsWith("/b2b") || p.startsWith("/reports/b2b");
const inReports = (p: string) => p === "/reports" || p.startsWith("/reports/payment");

function Section({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <>
      <button
        type="button"
        className={`nav-it${open ? " active" : ""}`}
        onClick={onToggle}
        style={{ background: "transparent", border: "none", width: "100%", textAlign: "left" }}
      >
        {label}
        <span className={`nav-arrow${open ? " open" : ""}`}>{open ? "-" : "+"}</span>
      </button>
      {open && <div className="nav-children">{children}</div>}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole, currentUser } = useApp();

  const [b2cOpen, setB2cOpen] = useState<boolean>(inB2C(pathname));
  const [b2bOpen, setB2bOpen] = useState<boolean>(inB2B(pathname));
  const [groupOpen, setGroupOpen] = useState<boolean>(inGroup(pathname));
  const [reportsOpen, setReportsOpen] = useState<boolean>(inReports(pathname));

  // Landing inside a section opens it; a section the user closed by hand
  // stays closed until they navigate into it again.
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    if (inB2C(pathname)) setB2cOpen(true);
    if (inB2B(pathname)) setB2bOpen(true);
    if (inGroup(pathname)) setGroupOpen(true);
    if (inReports(pathname)) setReportsOpen(true);
  }

  const link = (href: string, label: string, active = isSimpleActive(pathname, href)) => (
    <Link href={href} className={`nav-it child${active ? " active" : ""}`}>
      {label}
    </Link>
  );
  const financeReports = (
    <>
      {link("/reports/payment-pending", "Payment Pending")}
      {link("/reports/payments-received", "Payments Received")}
    </>
  );

  const isFrontOffice = currentRole === "Front Office";
  const isAdmin = currentRole === "Admin";
  // Finance is a read-only reporting role: the Revenue Register and nothing else
  const isFinance = currentRole === "Finance";

  if (isFinance) {
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
            href="/revenue"
            className={`nav-it${isSimpleActive(pathname, "/revenue") ? " active" : ""}`}
          >
            Revenue
          </Link>
          <Section label="Reports" open={reportsOpen} onToggle={() => setReportsOpen((v) => !v)}>
            {financeReports}
          </Section>
        </nav>
        <div className="sb-ft">
          <div style={{ fontSize: 11, color: "var(--t3)", paddingLeft: 12 }}>
            {currentUser} · {currentRole}
          </div>
        </div>
      </div>
    );
  }

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
            <Section label="B2C" open={b2cOpen} onToggle={() => setB2cOpen((v) => !v)}>
              {link("/bookings", "B2C Bookings", isB2CActive(pathname))}
              {link("/reports/b2c/lost", "B2C Enquiries Lost")}
              {link("/reports/b2c/completed", "B2C Bookings Completed")}
              {link("/reports/b2c/conversion", "B2C Conversion")}
            </Section>
            <Section label="B2B" open={b2bOpen} onToggle={() => setB2bOpen((v) => !v)}>
              {link("/b2b", "B2B Bookings")}
              {link("/reports/b2b/lost", "B2B Enquiries Lost")}
              {link("/reports/b2b/completed", "B2B Bookings Completed")}
              {link("/reports/b2b/conversion", "B2B Conversion")}
            </Section>
            <Section label="Group" open={groupOpen} onToggle={() => setGroupOpen((v) => !v)}>
              {link("/group-bookings", "Group Bookings", isGroupActive(pathname))}
              {link("/reports/group/lost", "Group Enquiries Lost")}
              {link("/reports/group/completed", "Group Bookings Completed")}
              {link("/reports/group/conversion", "Group Conversion")}
            </Section>
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

            <Section label="Reports" open={reportsOpen} onToggle={() => setReportsOpen((v) => !v)}>
              {financeReports}
            </Section>

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
