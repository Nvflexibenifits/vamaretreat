"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { depositHeld, fmt, fmtIN, isGroupBooking, tdsOfPayments, todayStr } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import type { BookingStatus } from "@/types";

// Same working list as B2C: "Open" is tentative and confirmed groups whose
// check-in is today or later, a date condition on top of status. Lost and
// completed groups live in their own reports.
type ListFilter = "Open" | "All" | BookingStatus;
const FILTERS: ListFilter[] = ["Open", "Enquiry", "Tentative", "Confirmed", "All"];
const FILTER_HINT: Record<ListFilter, string> = {
  Open: "Tentative and confirmed groups checking in from today onwards",
  All: "Every group booking on any date, except Lost and Completed",
  Enquiry: "Group enquiries on any date",
  Tentative: "Tentative groups on any date",
  Confirmed: "Confirmed groups on any date",
  Completed: "",
  Lost: "",
  Cancelled: "",
};

// Group bookings: one party taking several villas, often billed to a
// company. Same table and same detail page as B2C; this list shows only the
// bookings saved with kind "group".
export default function GroupBookingsPage() {
  const { bookings, currentRole } = useApp();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ListFilter>("Open");
  const [search, setSearch] = useState("");
  const [today] = useState(() => todayStr());

  const data = useMemo(() => {
    const s = search.trim().toLowerCase();
    return bookings
      .filter(isGroupBooking)
      .filter((b) => {
        if (b.status === "Lost" || b.status === "Completed") return false;
        if (statusFilter === "Open") {
          if (b.checkin < today || (b.status !== "Tentative" && b.status !== "Confirmed")) return false;
        } else if (statusFilter !== "All" && b.status !== statusFilter) return false;
        if (
          s &&
          !b.guest.toLowerCase().includes(s) &&
          !b.id.toLowerCase().includes(s) &&
          !b.mobile.includes(s) &&
          !(b.billing?.company ?? "").toLowerCase().includes(s)
        )
          return false;
        return true;
      })
      // Earliest check-in first, same as the B2C list
      .sort((a, b) => a.checkin.localeCompare(b.checkin) || a.id.localeCompare(b.id));
  }, [bookings, statusFilter, search, today]);

  if (currentRole === "Front Office" || currentRole === "Finance") {
    return (
      <div className="view">
        <div className="pg-hd"><div><h2>Access Denied</h2><p>Booking list is not available for your role.</p></div></div>
      </div>
    );
  }

  const todayCheckins = bookings.filter(
    (b) => isGroupBooking(b) && b.checkin === today && (b.status === "Confirmed" || b.status === "Tentative")
  ).length;

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Group Bookings</h2>
          <p>{FILTER_HINT[statusFilter]}</p>
        </div>
        <div className="pg-hd-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px" }} title="Tentative and confirmed groups checking in today">
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".4px" }}>
              Today&apos;s Check-ins
            </span>
            <span style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 16, fontWeight: 800, color: todayCheckins > 0 ? "var(--acc)" : "var(--t2)" }}>
              {todayCheckins}
            </span>
          </div>
          <Link href="/group-bookings/new" className="btn btn-primary">
            New Group Booking
          </Link>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <input
            className="search-inp"
            placeholder="Search guest, company, ID, mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-btn${statusFilter === f ? " on" : ""}`}
            onClick={() => setStatusFilter(f)}
            title={FILTER_HINT[f]}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Guest</th>
              <th>Billed to</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Nights</th>
              <th>Villas</th>
              <th>Amount Due</th>
              <th>Received</th>
              <th title="Withheld by the payer, settles the bill">TDS</th>
              <th title="Security deposit still held, outside the bill">Deposit Held</th>
              <th>Balance</th>
              <th>Status</th>
              <th>REX</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={15}>
                  <div className="empty-state">
                    <h3>{statusFilter === "Open" ? "No open group bookings" : "No group bookings"}</h3>
                    <p>
                      {statusFilter === "Open"
                        ? "Nothing tentative or confirmed from today onwards. Pick All to see past groups and enquiries."
                        : "Create one with the New Group Booking button"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((b) => {
                const pending = b.status === "Cancelled" ? 0 : b.balance;
                const amountDue = b.grandTotal - (b.waiveOff?.totalGross ?? 0);
                const tds = tdsOfPayments(b.payments);
                const held = depositHeld(b);
                return (
                  <tr key={b.id} onClick={() => router.push(`/bookings/${b.id}`)}>
                    <td>
                      <span style={{ fontSize: 10, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--t3)", fontWeight: 700 }}>
                        {b.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--t1)" }}>{b.guest}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{b.mobile}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: b.billing?.company ? "var(--t1)" : "var(--t3)" }}>{b.billing?.company || "—"}</span>
                      {b.billing?.gstin && <div style={{ fontSize: 10, color: "var(--t3)" }}>{b.billing.gstin}</div>}
                    </td>
                    <td>{fmtIN(b.checkin)}</td>
                    <td>{fmtIN(b.checkout)}</td>
                    <td>{b.checkin === b.checkout ? "Dayout" : b.nights}</td>
                    <td style={{ textAlign: "center" }}>{b.allocatedRooms.length || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(amountDue)}</td>
                    <td style={{ fontWeight: 500, color: "var(--grn)" }}>{fmt(b.advance)}</td>
                    <td style={{ color: tds > 0 ? "var(--t1)" : "var(--t3)" }}>{tds > 0 ? fmt(tds) : "—"}</td>
                    <td style={{ color: held > 0 ? "var(--acc)" : "var(--t3)", fontWeight: held > 0 ? 600 : 400 }}>{held > 0 ? fmt(held) : "—"}</td>
                    <td
                      style={{
                        fontWeight: 500,
                        color: pending >= 1 ? "var(--amb)" : pending <= -1 ? "var(--pur)" : "var(--t3)",
                      }}
                      title={pending >= 1 ? "Amount pending" : pending <= -1 ? "Excess received" : "Settled"}
                    >
                      {pending >= 1 ? fmt(pending) : pending <= -1 ? `Excess ${fmt(-pending)}` : "0"}
                    </td>
                    <td><StatusBadge status={b.status} /></td>
                    <td style={{ fontSize: 11, color: "var(--t3)" }}>{b.rex}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      <Link href={`/bookings/${b.id}`} className="btn btn-ghost btn-xs">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
