"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { b2bStatusNow, fmt, fmtIN, statusBadgeClass, todayStr } from "@/lib/utils";
import type { B2BStatus, B2BType } from "@/types";

const TYPE_FILTERS: ("All" | B2BType)[] = ["All", "Corporate", "School", "Institute"];
// "Open" is the working list: tentative and confirmed bookings whose
// check-in is today or later, the same rule as the B2C list. Lost and
// Completed have their own reports under B2B, so even "All" leaves them out;
// Cancelled bookings sit behind their own chip.
type ListFilter = "Open" | "All" | B2BStatus;
const STATUS_FILTERS: ListFilter[] = ["Open", "Enquiry", "Tentative", "Confirmed", "Cancelled", "All"];
const FILTER_HINT: Record<ListFilter, string> = {
  Open: "Tentative and confirmed bookings checking in from today onwards",
  All: "Every booking on any date, except Lost, Completed and Cancelled",
  Enquiry: "Enquiries on any date, except ones whose check-in has passed",
  Tentative: "Tentative bookings on any date, except ones whose check-in has passed",
  Confirmed: "Confirmed bookings on any date, except ones whose dates have passed",
  Completed: "",
  Lost: "",
  Cancelled: "Confirmed bookings that were called off, with the refund or credit note given",
};

export default function B2BBookingsPage() {
  const { b2bBookings, bulkRoomBlocks, venueBlocks, currentRole } = useApp();

  // "3 villas · 1 venue" from the chart blocks a booking holds
  const holdSummary = (roomBlockId?: string | null, venueBlockIds?: string[]): string => {
    const blk = roomBlockId ? bulkRoomBlocks.find((x) => x.id === roomBlockId) : undefined;
    const villas = blk ? blk.rows.reduce((s, r) => s + r.roomIds.length, 0) : 0;
    const venueCount = (venueBlockIds ?? []).filter((id) => venueBlocks.some((vb) => vb.id === id)).length;
    const parts: string[] = [];
    if (villas > 0) parts.push(`${villas} villa${villas === 1 ? "" : "s"}`);
    if (venueCount > 0) parts.push(`${venueCount} venue${venueCount === 1 ? "" : "s"}`);
    return parts.join(" · ");
  };
  const [typeFilter, setTypeFilter] = useState<"All" | B2BType>("All");
  const [statusFilter, setStatusFilter] = useState<ListFilter>("Open");
  const [search, setSearch] = useState("");
  const [today] = useState(() => todayStr());

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return b2bBookings
      .map((b) => ({ ...b, statusNow: b2bStatusNow(b, today) }))
      .filter((b) => typeFilter === "All" || b.type === typeFilter)
      .filter((b) => {
        if (b.statusNow === "Lost" || b.statusNow === "Completed") return false;
        if (b.statusNow === "Cancelled") return statusFilter === "Cancelled";
        if (statusFilter === "Open") return b.checkin >= today && (b.statusNow === "Tentative" || b.statusNow === "Confirmed");
        return statusFilter === "All" || b.statusNow === statusFilter;
      })
      .filter(
        (b) =>
          !q ||
          b.id.toLowerCase().includes(q) ||
          b.orgName.toLowerCase().includes(q) ||
          b.contactPerson.toLowerCase().includes(q)
      )
      // Earliest check-in first: the next event is what the team works on
      .sort((a, b) => a.checkin.localeCompare(b.checkin) || a.id.localeCompare(b.id));
  }, [b2bBookings, typeFilter, statusFilter, search, today]);

  const totals = rows.reduce(
    (t, b) => ({
      grandTotal: t.grandTotal + b.grandTotal,
      advance: t.advance + b.advance,
      balance: t.balance + Math.max(0, b.balance),
    }),
    { grandTotal: 0, advance: 0, balance: 0 }
  );

  if (currentRole === "Front Office" || currentRole === "Finance") {
    return (
      <div className="view">
        <div className="pg-hd">
          <div>
            <h2>Access Denied</h2>
            <p>B2B Bookings are not available for your role.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>B2B Bookings</h2>
          <p>{FILTER_HINT[statusFilter]}</p>
        </div>
        <Link href="/b2b/new" className="btn btn-primary btn-sm">
          New B2B Booking
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {TYPE_FILTERS.map((t) => (
          <button
            key={t}
            className={`btn btn-sm${typeFilter === t ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setTypeFilter(t)}
          >
            {t === "All" ? "All types" : t}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: "var(--bd)", margin: "0 4px" }} />
        {STATUS_FILTERS.map((st) => (
          <button
            key={st}
            className={`btn btn-sm${statusFilter === st ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setStatusFilter(st)}
            title={FILTER_HINT[st]}
          >
            {st}
          </button>
        ))}
        <input
          type="search"
          placeholder="Search ID, org or contact"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginLeft: "auto",
            width: 220,
            height: 32,
            padding: "0 10px",
            border: "1px solid var(--bd)",
            borderRadius: "var(--r2)",
            fontSize: 13,
            background: "var(--surf)",
            outline: "none",
          }}
        />
      </div>

      <div className="tbl-wrap">
        <div className="tbl-hd">
          <h3>B2B Bookings &mdash; {rows.length}</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th style={{ whiteSpace: "nowrap" }}>Booking ID</th>
              <th>Organisation</th>
              <th style={{ whiteSpace: "nowrap" }}>Type</th>
              <th>Contact</th>
              <th style={{ whiteSpace: "nowrap" }}>Dates</th>
              <th style={{ textAlign: "center", width: 60 }}>Pax</th>
              <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Amount Due</th>
              <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Received</th>
              <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Balance</th>
              <th style={{ whiteSpace: "nowrap" }}>Status</th>
              <th style={{ textAlign: "center", width: 72 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  <div className="empty-state">
                    <h3>{statusFilter === "Open" ? "No open B2B bookings" : "No B2B bookings"}</h3>
                    <p>
                      {statusFilter === "Open"
                        ? "Nothing tentative or confirmed from today onwards. Pick All to see enquiries, or the B2B reports for lost and completed."
                        : "Create one with the New B2B Booking button"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link
                        href={`/b2b/${b.id}`}
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-outfit), Outfit, sans-serif",
                          color: "var(--acc)",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        {b.id}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--t1)" }}>{b.orgName}</td>
                    <td style={{ fontSize: 12, color: "var(--t2)" }}>{b.type}</td>
                    <td>
                      <div style={{ fontSize: 12, color: "var(--t1)" }}>{b.contactPerson}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{b.contactNumber}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                      {b.bookingType === "Dayout"
                        ? `${fmtIN(b.checkin)} · Dayout`
                        : `${fmtIN(b.checkin)} → ${fmtIN(b.checkout)}`}
                      {holdSummary(b.roomBlockId, b.venueBlockIds) && (
                        <div style={{ fontSize: 11, color: "var(--t3)" }}>{holdSummary(b.roomBlockId, b.venueBlockIds)}</div>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>{b.pax || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(b.grandTotal)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(b.advance)}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: b.balance >= 1 ? "var(--amb)" : b.balance <= -1 ? "var(--pur)" : "var(--grn)",
                      }}
                      title={b.balance <= -1 ? "Excess received" : undefined}
                    >
                      {b.balance >= 1 ? fmt(b.balance) : b.balance <= -1 ? `Excess ${fmt(-b.balance)}` : "Nil"}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(b.statusNow)}`}>{b.statusNow}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Link href={`/b2b/${b.id}`} className="btn btn-ghost btn-xs">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                  <td colSpan={6} style={{ textAlign: "right", color: "var(--t1)" }}>
                    Total
                  </td>
                  <td style={{ textAlign: "right" }}>{fmt(totals.grandTotal)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(totals.advance)}</td>
                  <td style={{ textAlign: "right", color: "var(--amb)" }}>{fmt(totals.balance)}</td>
                  <td colSpan={2} />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
