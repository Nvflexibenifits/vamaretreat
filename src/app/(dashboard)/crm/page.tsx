"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN } from "@/lib/utils";

type GuestRow = {
  name: string;
  mobile: string;
  stays: number;
  spent: number;
  last: string;
};

export default function CrmPage() {
  const { bookings, guestNotes, openModal, currentRole } = useApp();
  const [search, setSearch] = useState("");

  if (currentRole === "Front Office") {
    return (
      <div className="view">
        <div className="pg-hd"><div><h2>Access Denied</h2><p>CRM is not available for your role.</p></div></div>
      </div>
    );
  }

  const guests = useMemo<GuestRow[]>(() => {
    const map: Record<string, GuestRow> = {};
    bookings
      .filter((b) => b.status !== "Lost")
      .forEach((b) => {
        const key = b.mobile;
        if (!map[key]) {
          map[key] = { name: b.guest, mobile: b.mobile, stays: 0, spent: 0, last: b.checkin };
        }
        map[key] = {
          name: b.guest,
          mobile: b.mobile,
          stays: map[key].stays + 1,
          spent: map[key].spent + b.grandTotal,
          last: b.checkin > map[key].last ? b.checkin : map[key].last,
        };
      });
    return Object.values(map);
  }, [bookings]);

  const s = search.toLowerCase();
  const filtered = guests
    .filter((g) => !s || g.name.toLowerCase().includes(s) || g.mobile.includes(s))
    .sort((a, b) => b.spent - a.spent);

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Guest CRM</h2>
          <p>All guests from bookings — searchable, with stay history and spend</p>
        </div>
        <button className="btn btn-ghost btn-sm">⬇ Export CSV</button>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <input
            className="search-inp"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Guest Name</th>
              <th>Mobile</th>
              <th>Total Stays</th>
              <th>Total Spent</th>
              <th>Last Stay</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <h3>No guests found</h3>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((g, i) => (
                <tr key={g.mobile}>
                  <td style={{ color: "var(--t3)" }}>{i + 1}</td>
                  <td><div style={{ fontWeight: 500, color: "var(--t1)" }}>{g.name}</div></td>
                  <td>{g.mobile}</td>
                  <td style={{ textAlign: "center" }}>{g.stays}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(g.spent)}</td>
                  <td style={{ fontSize: 12, color: "var(--t3)" }}>{fmtIN(g.last)}</td>
                  <td style={{ fontSize: 12, color: "var(--t2)", maxWidth: 160 }}>
                    {guestNotes[g.mobile] || "—"}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        openModal({ kind: "crm-note", crmKey: { mobile: g.mobile, name: g.name } })
                      }
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
