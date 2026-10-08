"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, fmtIN } from "@/lib/utils";
import type { CreditNote } from "@/types";

function statusStyle(status: CreditNote["status"]): React.CSSProperties {
  if (status === "Available") return { background: "var(--grn-bg)", color: "var(--grn)" };
  if (status === "Partially Used") return { background: "var(--amb-bg)", color: "var(--amb)" };
  return { background: "var(--bd)", color: "var(--t2)" };
}

export default function CreditNotesPage() {
  const { creditNotes, bookings, currentRole } = useApp();
  // Notes issued by a cancellation here, or loaded from the pre-system
  // register. Same store, same redemption; only the origin differs.
  const [tab, setTab] = useState<"system" | "older">("system");
  const [search, setSearch] = useState("");
  const olderCount = creditNotes.filter((n) => n.imported).length;
  const systemCount = creditNotes.length - olderCount;

  const notes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...creditNotes]
      .filter((n) => (tab === "older" ? !!n.imported : !n.imported))
      .filter((n) => !q || n.code.toLowerCase().includes(q) || n.guestName.toLowerCase().includes(q) || n.guestMobile.includes(q))
      .sort((a, b) => (tab === "older" ? a.code.localeCompare(b.code, undefined, { numeric: true }) : b.cancellationDate.localeCompare(a.cancellationDate)))
      .map((n) => {
        // Advance actually received on the cancelled source booking
        const b = bookings.find((x) => x.id === n.originalBookingId);
        let advance = (b?.payments ?? []).reduce((s, p) => s + p.amount, 0);
        if (advance === 0 && (b?.advance ?? 0) > 0) advance = b!.advance;
        return { n, advance };
      });
  }, [creditNotes, bookings, tab, search]);

  const totals = useMemo(
    () =>
      notes.reduce(
        (t, r) => ({
          advance: t.advance + r.advance,
          issued: t.issued + r.n.totalAmount,
          redeemed: t.redeemed + r.n.usedAmount,
          outstanding: t.outstanding + r.n.remainingAmount,
        }),
        { advance: 0, issued: 0, redeemed: 0, outstanding: 0 }
      ),
    [notes]
  );

  if (currentRole === "Front Office" || currentRole === "Finance") {
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
          <p>{tab === "older" ? "Loaded from the credit note register as on 31 Aug 2026. Redeem them on a booking like any other note." : "Issued by cancellations in this system."}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className={`filter-btn${tab === "system" ? " on" : ""}`} onClick={() => setTab("system")}>
            Issued by System ({systemCount})
          </button>
          <button type="button" className={`filter-btn${tab === "older" ? " on" : ""}`} onClick={() => setTab("older")}>
            Older Credit Notes ({olderCount})
          </button>
          <input
            type="text"
            placeholder="Search code, guest, mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 32, padding: "0 10px", fontSize: 13, border: "1px solid var(--bd)", borderRadius: "var(--r2)", background: "var(--surf)", color: "var(--t1)", minWidth: 220 }}
          />
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
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
                <th style={{ whiteSpace: "nowrap" }}>{tab === "older" ? "Register Date" : "Issued On"}</th>
                <th>Guest</th>
                <th style={{ whiteSpace: "nowrap" }}>{tab === "older" ? "Remark" : "Booking ID"}</th>
                {tab === "system" && <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Advance Amt</th>}
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Credit Note Amt</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Redeemed</th>
                <th style={{ textAlign: "right", whiteSpace: "nowrap" }}>Balance</th>
                <th style={{ whiteSpace: "nowrap" }}>Status</th>
                <th style={{ textAlign: "center", width: 70 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {notes.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state" style={{ padding: 32 }}>
                      <p>{tab === "older" ? (search ? "No older credit notes match the search." : "No older credit notes loaded.") : "No credit notes issued yet. They are created when a booking is cancelled with a credit note resolution."}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                {notes.map(({ n, advance }) => (
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
                    {n.imported ? (
                      <td style={{ fontSize: 11, color: "var(--t3)", maxWidth: 260 }}>{n.imported.remark || "—"}</td>
                    ) : (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <Link
                          href={`/bookings/${n.originalBookingId}`}
                          style={{ fontSize: 11, fontFamily: "var(--font-outfit), Outfit, sans-serif", color: "var(--acc)", fontWeight: 700, textDecoration: "none" }}
                        >
                          {n.originalBookingId}
                        </Link>
                      </td>
                    )}
                    {tab === "system" && <td style={{ textAlign: "right" }}>{advance > 0 ? fmt(advance) : "—"}</td>}
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(n.totalAmount)}</td>
                    <td style={{ textAlign: "right" }}>
                      {n.usedAmount > 0 ? fmt(n.usedAmount) : "—"}
                      {(n.transactions ?? []).length > 0 && (
                        <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                          {(n.transactions ?? []).map((t, i) => (
                            <div key={i} style={{ whiteSpace: "nowrap", color: t.amountUsed < 0 ? "var(--grn)" : undefined }}>
                              {t.amountUsed < 0 ? `${fmt(-t.amountUsed)} restored from` : `${fmt(t.amountUsed)} on`}{" "}
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
                      {n.imported ? (
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>Imported</span>
                      ) : (
                        <Link href={`/bookings/${n.originalBookingId}`} className="btn btn-ghost btn-xs">
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "var(--surf2)", fontWeight: 700 }}>
                  <td colSpan={4} style={{ textAlign: "right", fontSize: 12, color: "var(--t2)" }}>Total</td>
                  {tab === "system" && <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totals.advance)}</td>}
                  <td style={{ textAlign: "right", fontWeight: 800 }}>{fmt(totals.issued)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(totals.redeemed)}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: totals.outstanding > 0 ? "var(--amb)" : "var(--t3)" }}>
                    {fmt(totals.outstanding)}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
