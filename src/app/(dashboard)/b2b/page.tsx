"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN, statusBadgeClass } from "@/lib/utils";
import type { B2BStatus, B2BType } from "@/types";

const TYPE_FILTERS: ("All" | B2BType)[] = ["All", "Corporate", "School", "Institute"];
const STATUS_FILTERS: ("All" | B2BStatus)[] = ["All", "Enquiry", "Tentative", "Confirmed"];

export default function B2BBookingsPage() {
  const { b2bBookings, currentRole } = useApp();
  const [typeFilter, setTypeFilter] = useState<"All" | B2BType>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | B2BStatus>("All");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...b2bBookings]
      .filter((b) => typeFilter === "All" || b.type === typeFilter)
      .filter((b) => statusFilter === "All" || b.status === statusFilter)
      .filter(
        (b) =>
          !q ||
          b.id.toLowerCase().includes(q) ||
          b.orgName.toLowerCase().includes(q) ||
          b.contactPerson.toLowerCase().includes(q)
      )
      .sort((a, b) => b.checkin.localeCompare(a.checkin) || b.id.localeCompare(a.id));
  }, [b2bBookings, typeFilter, statusFilter, search]);

  const totals = rows.reduce(
    (t, b) => ({
      grandTotal: t.grandTotal + b.grandTotal,
      advance: t.advance + b.advance,
      balance: t.balance + b.balance,
    }),
    { grandTotal: 0, advance: 0, balance: 0 }
  );

  if (currentRole === "Front Office") {
    return (
      <div className="view">
        <div className="pg-hd">
          <div>
            <h2>Access Denied</h2>
            <p>B2B Bookings are not available to Front Office.</p>
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
          <p>Corporate, school and institute bookings</p>
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
            {t}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: "var(--bd)", margin: "0 4px" }} />
        {STATUS_FILTERS.map((st) => (
          <button
            key={st}
            className={`btn btn-sm${statusFilter === st ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setStatusFilter(st)}
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
                    <h3>No B2B bookings</h3>
                    <p>Create one with the New B2B Booking button</p>
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
                    </td>
                    <td style={{ textAlign: "center" }}>{b.pax || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(b.grandTotal)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(b.advance)}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: b.balance >= 1 ? "var(--amb)" : "var(--grn)",
                      }}
                    >
                      {b.balance >= 1 ? fmt(b.balance) : "Nil"}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(b.status)}`}>{b.status}</span>
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
