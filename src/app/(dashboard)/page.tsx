"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, getTimeOfDay, todayStr } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";

export default function DashboardPage() {
  const router = useRouter();
  const { bookings, revenueEntries, currentUser } = useApp();
  const [greeting, setGreeting] = useState("");
  const [today, setToday] = useState("");

  useEffect(() => {
    setGreeting(getTimeOfDay());
    setToday(todayStr());
  }, []);

  const arrivals = useMemo(
    () => bookings.filter((b) => b.checkin === today && (b.status === "Confirmed" || b.status === "Completed")),
    [bookings, today]
  );

  const drafts = bookings.filter((b) => b.status === "Draft").length;
  const totalBal = bookings.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const balBookings = bookings.filter((b) => b.balance > 0).length;
  const revThisMonth = revenueEntries
    .filter((e) => e.date && e.date.startsWith("2026-05"))
    .reduce((s, e) => s + e.amount, 0);

  const recent = bookings.slice(0, 5);
  const unalloc = bookings.filter((b) => b.status === "Confirmed" && !b.allocatedRoom);

  const lostReasons = useMemo(() => {
    const reasons: Record<string, number> = {};
    bookings
      .filter((b) => b.status === "Lost" && b.lostReason)
      .forEach((b) => {
        reasons[b.lostReason!] = (reasons[b.lostReason!] || 0) + 1;
      });
    return Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  }, [bookings]);
  const maxR = Math.max(...lostReasons.map(([, c]) => c), 1);

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>{greeting ? `Good ${greeting}, ${currentUser} 👋` : `Hello, ${currentUser} 👋`}</h2>
          <p>Here&apos;s what&apos;s happening at Vama Retreats today</p>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-lbl">Today&apos;s Check-ins</div>
          <div className="stat-val">{arrivals.length}</div>
          <div className="stat-sub">
            {arrivals.length ? arrivals.map((b) => b.guest.split(" ")[0]).join(", ") : "No arrivals today"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Open Enquiries</div>
          <div className="stat-val">{drafts}</div>
          <div className="stat-sub">Awaiting confirmation</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Balance Pending</div>
          <div className="stat-val">{fmt(totalBal)}</div>
          <div className="stat-sub">Across {balBookings} booking{balBookings !== 1 ? "s" : ""}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">May Revenue</div>
          <div className="stat-val">₹{(revThisMonth / 100000).toFixed(1)}L</div>
          <div className="stat-chg stat-up"></div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="sec-div">Today&apos;s Arrivals</div>
          <div className="card" style={{ padding: 0 }}>
            <div>
              {arrivals.length === 0 ? (
                <div className="empty-state" style={{ padding: 28 }}>
                  <div className="empty-icon">✓</div>
                  <p>No arrivals today</p>
                </div>
              ) : (
                arrivals.map((b) => (
                  <div
                    key={b.id}
                    className="arrival-item"
                    onClick={() => router.push(`/bookings/${b.id}`)}
                  >
                    <div className="arrival-av">{b.guest[0]}</div>
                    <div>
                      <div className="arrival-name">{b.guest}</div>
                      <div className="arrival-meta">
                        {b.rooms.map((r) => r.name + (r.qty > 1 ? " ×" + r.qty : "")).join(", ")} · {b.adults} Adults
                      </div>
                    </div>
                    <div className="arrival-right">
                      <div className="arrival-amt">{fmt(b.total)}</div>
                      {b.balance > 0 ? (
                        <div className="arrival-bal">Balance: {fmt(b.balance)}</div>
                      ) : (
                        <div style={{ fontSize: 11, color: "var(--grn)" }}>Fully paid ✓</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="sec-div" style={{ marginTop: 18 }}>New Booking</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Link
              href="/bookings/new"
              className="card"
              style={{ cursor: "pointer", border: "1.5px solid var(--bd)", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ fontSize: 20, marginBottom: 8 }}>🏠</div>
              <div className="card-title">B2C Guest</div>
              <p style={{ fontSize: 12, color: "var(--t3)" }}>Individual or family</p>
              <div style={{ marginTop: 8 }}>
                <span className="badge bd-active" style={{ fontSize: 9 }}>Phase 1 · Live</span>
              </div>
            </Link>
            <div className="card phase2-lock" style={{ cursor: "not-allowed", opacity: 0.55 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🐾</div>
              <div className="card-title">B2C with Pet</div>
              <p style={{ fontSize: 12, color: "var(--t3)" }}>Pet-friendly stay</p>
            </div>
            <div className="card phase2-lock" style={{ cursor: "not-allowed", opacity: 0.55 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🏢</div>
              <div className="card-title">Corporate</div>
              <p style={{ fontSize: 12, color: "var(--t3)" }}>Day out / overnight</p>
            </div>
            <div className="card phase2-lock" style={{ cursor: "not-allowed", opacity: 0.55 }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🎊</div>
              <div className="card-title">Events / Banquet</div>
              <p style={{ fontSize: 12, color: "var(--t3)" }}>Weddings, functions</p>
            </div>
          </div>
        </div>

        <div>
          <div className="sec-div">Recent Bookings</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Check-in</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id} onClick={() => router.push(`/bookings/${b.id}`)}>
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--t1)" }}>{b.guest}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)" }}>{b.id}</div>
                    </td>
                    <td>{b.checkin}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(b.total)}</td>
                    <td><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sec-div" style={{ marginTop: 16 }}>Rooms Needing Allocation</div>
          <div>
            {unalloc.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--grn)", padding: "8px 0" }}>
                All confirmed bookings allocated ✓
              </div>
            ) : (
              unalloc.map((b) => (
                <div
                  key={b.id}
                  className="card"
                  style={{
                    marginBottom: 8,
                    cursor: "pointer",
                    borderColor: "var(--amb-bg)",
                    background: "var(--amb-lt)",
                  }}
                  onClick={() => router.push("/room-chart")}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.guest}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>
                        {b.checkin} · {b.rooms.map((r) => r.name).join(", ")}
                      </div>
                    </div>
                    <span className="badge bd-pending">Allocate room →</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="sec-div" style={{ marginTop: 16 }}>Lost Enquiry Reasons</div>
          <div className="card">
            {lostReasons.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--t3)", textAlign: "center", padding: "16px 0" }}>
                No lost enquiries yet
              </div>
            ) : (
              lostReasons.map(([reason, count]) => (
                <div key={reason} className="lost-bar">
                  <div className="lost-bar-label">{reason}</div>
                  <div className="lost-bar-track">
                    <div className="lost-bar-fill" style={{ width: `${Math.round((count / maxR) * 100)}%` }} />
                  </div>
                  <div className="lost-bar-count">{count}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
