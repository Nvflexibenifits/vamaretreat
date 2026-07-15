"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN } from "@/lib/utils";
import type { CreditNote } from "@/types";

function statusStyle(status: CreditNote["status"]): React.CSSProperties {
  if (status === "Available") return { background: "var(--grn-bg)", color: "var(--grn)" };
  if (status === "Partially Used") return { background: "var(--amb-bg)", color: "var(--amb)" };
  return { background: "var(--bd)", color: "var(--t2)" };
}

export default function CreditNotesPage() {
  const { creditNotes, currentRole } = useApp();

  const notes = useMemo(
    () => [...creditNotes].sort((a, b) => b.cancellationDate.localeCompare(a.cancellationDate)),
    [creditNotes]
  );

  const totals = useMemo(
    () =>
      notes.reduce(
        (t, n) => ({
          issued: t.issued + n.totalAmount,
          redeemed: t.redeemed + n.usedAmount,
          outstanding: t.outstanding + n.remainingAmount,
        }),
        { issued: 0, redeemed: 0, outstanding: 0 }
      ),
    [notes]
  );

  if (currentRole === "Front Office") {
    return (
      <div className="view">
        <div className="pg-hd">
          <div><h2>Access Denied</h2><p>Credit Notes are not available for your role.</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Credit Notes</h2>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 18 }}>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Total Issued
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--sb)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(totals.issued)}
          </div>
        </div>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Redeemed
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--grn)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(totals.redeemed)}
          </div>
        </div>
        <div style={{ background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r4)", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
            Outstanding
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: totals.outstanding > 0 ? "var(--amb)" : "var(--t2)", fontFamily: "var(--font-outfit), Outfit, sans-serif" }}>
            {fmt(totals.outstanding)}
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="tbl-wrap">
        <div className="tbl-hd">
          <h3>Credit Note Ledger</h3>
          <span style={{ fontSize: 12, color: "var(--t3)", marginLeft: "auto" }}>
            {notes.length} credit note{notes.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: "nowrap" }}>Credit Note No.</th>
                <th style={{ whiteSpace: "nowrap" }}>Issued On</th>
                <th>Guest</th>
                <th style={{ whiteSpace: "nowrap" }}>Booking ID</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Amount</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Redeemed</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Remaining</th>
                <th style={{ whiteSpace: "nowrap" }}>Status</th>
                <th style={{ textAlign: "center", width: 70 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {notes.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state" style={{ padding: 32 }}>
                      <p>No credit notes issued yet. They are created when a booking is cancelled with a credit note resolution.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                notes.map((n) => (
                  <tr key={n.code}>
                    <td>
                      <span style={{ fontSize: 12, fontFamily: "var(--font-outfit), Outfit, sans-serif", fontWeight: 700, color: "var(--t1)" }}>
                        {n.code}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtIN(n.cancellationDate)}</td>
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--t1)" }}>{n.guestName}</div>
                      <div style={{ fontSize: 11, color: "var(--t3)" }}>{n.guestMobile}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <Link
                        href={`/bookings/${n.originalBookingId}`}
                        style={{ fontSize: 11, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--acc)", fontWeight: 700, textDecoration: "none" }}
                      >
                        {n.originalBookingId}
                      </Link>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(n.totalAmount)}</td>
                    <td style={{ textAlign: "right" }}>
                      {n.usedAmount > 0 ? fmt(n.usedAmount) : "—"}
                      {(n.transactions ?? []).length > 0 && (
                        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                          {(n.transactions ?? []).map((t, i) => (
                            <div key={i} style={{ whiteSpace: "nowrap" }}>
                              {fmt(t.amountUsed)} on{" "}
                              <Link href={`/bookings/${t.bookingId}`} style={{ color: "var(--acc)", textDecoration: "none" }}>
                                {t.bookingId}
                              </Link>{" "}
                              · {fmtIN(t.date)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: n.remainingAmount > 0 ? "var(--amb)" : "var(--t3)" }}>
                      {fmt(n.remainingAmount)}
                    </td>
                    <td>
                      <span className="badge" style={statusStyle(n.status)}>{n.status}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <Link href={`/bookings/${n.originalBookingId}`} className="btn btn-ghost btn-xs">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
