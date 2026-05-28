"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { BookingForm } from "@/components/BookingForm";
import { fmt, fmtIN, todayStr } from "@/lib/utils";
import type { Extra } from "@/types";

type DraftRow = {
  name: string;
  amount: string;
  gst: string;
  totalPaid: string;
};

function emptyRow(): DraftRow {
  return { name: "", amount: "", gst: "", totalPaid: "" };
}

function ExtraExpensesSection({ bookingId }: { bookingId: string }) {
  const { bookings, addExtras, currentUser, showNotif } = useApp();
  const b = bookings.find((x) => x.id === bookingId);
  const [rows, setRows] = useState<DraftRow[]>([emptyRow()]);

  if (!b) return null;

  const setRow = (i: number, patch: Partial<DraftRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const autoFillTotal = (i: number, field: "amount" | "gst", val: string) => {
    setRows((prev) => {
      const next = prev.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
      const row = next[i];
      const a = parseFloat(row.amount) || 0;
      const g = parseFloat(row.gst) || 0;
      next[i] = { ...next[i], totalPaid: String(a + g || "") };
      return next;
    });
  };

  const save = () => {
    const valid = rows.filter((r) => r.name.trim() && (parseFloat(r.amount) || 0) > 0);
    if (valid.length === 0) {
      showNotif("Add at least one expense with a name and amount", "error");
      return;
    }
    const today = todayStr();
    const extras: Extra[] = valid.map((r) => ({
      name: r.name.trim(),
      amount: parseFloat(r.amount) || 0,
      gst: parseFloat(r.gst) || 0,
      totalPaid: parseFloat(r.totalPaid) || (parseFloat(r.amount) || 0) + (parseFloat(r.gst) || 0),
      date: today,
      by: currentUser,
    }));
    addExtras(bookingId, extras);
    setRows([emptyRow()]);
    showNotif(`${extras.length} expense${extras.length > 1 ? "s" : ""} added`, "success");
  };

  const existing = b.extras.filter((e) => !("upgradeExtra" in e));

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>Extra Expenses</h3>
        {existing.length > 0 && (
          <span className="badge" style={{ background: "var(--surf3)", color: "var(--t2)" }}>
            {existing.length} saved
          </span>
        )}
      </div>

      {/* Saved extras */}
      {existing.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <table className="pricing-tbl">
            <thead>
              <tr>
                <th>Nature of Expense</th>
                <th style={{ textAlign: "right", width: 110 }}>Amount (₹)</th>
                <th style={{ textAlign: "right", width: 90 }}>GST (₹)</th>
                <th style={{ textAlign: "right", width: 120 }}>Total Paid (₹)</th>
                <th style={{ width: 110 }}>Date</th>
                <th style={{ width: 90 }}>By</th>
              </tr>
            </thead>
            <tbody>
              {existing.map((e, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{e.name}</td>
                  <td style={{ textAlign: "right" }}>{fmt(e.amount)}</td>
                  <td style={{ textAlign: "right", color: "var(--t3)" }}>
                    {e.gst ? fmt(e.gst) : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>
                    {fmt(e.totalPaid ?? e.amount + (e.gst ?? 0))}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--t3)" }}>{fmtIN(e.date)}</td>
                  <td style={{ fontSize: 12, color: "var(--t3)" }}>{e.by}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--surf2)" }}>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  {fmt(existing.reduce((s, e) => s + e.amount, 0))}
                </td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>
                  {fmt(existing.reduce((s, e) => s + (e.gst ?? 0), 0))}
                </td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "var(--amb)" }}>
                  {fmt(existing.reduce((s, e) => s + (e.totalPaid ?? e.amount + (e.gst ?? 0)), 0))}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Add new rows */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 10 }}>
          Add New Expenses
        </div>
        <table className="pricing-tbl">
          <thead>
            <tr>
              <th>Nature of Expense *</th>
              <th style={{ width: 120 }}>Amount (₹) *</th>
              <th style={{ width: 110 }}>GST (₹)</th>
              <th style={{ width: 130 }}>Total Paid (₹)</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    placeholder="e.g. BBQ Dinner, Bonfire, Activity"
                    value={row.name}
                    onChange={(e) => setRow(i, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={row.amount}
                    placeholder="0"
                    onChange={(e) => autoFillTotal(i, "amount", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={row.gst}
                    placeholder="0"
                    onChange={(e) => autoFillTotal(i, "gst", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={row.totalPaid}
                    placeholder="auto"
                    onChange={(e) => setRow(i, { totalPaid: e.target.value })}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  {rows.length > 1 && (
                    <button
                      className="btn btn-ghost btn-xs"
                      style={{ color: "var(--red)" }}
                      onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
          >
            + Add Row
          </button>
          <button className="btn btn-primary btn-sm" onClick={save}>
            Save Expenses
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
        Total Paid auto-fills as Amount + GST. Override if the guest paid a different amount.
        Saving updates the booking total and balance.
      </div>
    </div>
  );
}

export default function EditBookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { bookings, hydrated, showNotif } = useApp();
  const id = params?.id;
  const b = bookings.find((x) => x.id === id);

  useEffect(() => {
    if (!hydrated) return;
    if (!b) {
      router.replace("/bookings");
      return;
    }
    if (b.status === "Lost" || b.status === "Cancelled") {
      showNotif(`${b.status} bookings can't be edited`, "error");
      router.replace(`/bookings/${b.id}`);
    }
  }, [hydrated, b, router, showNotif]);

  if (!hydrated) {
    return (
      <div className="view">
        <p style={{ color: "var(--t3)" }}>Loading…</p>
      </div>
    );
  }

  if (!b) return null;
  if (b.status === "Lost" || b.status === "Cancelled") return null;

  // Completed bookings: extras-only
  if (b.status === "Completed") {
    return (
      <div className="view">
        <div className="pg-hd">
          <div>
            <h2>Add Expenses — {b.id}</h2>
            <p>{b.guest} · Completed {fmtIN(b.checkout)}</p>
          </div>
          <Link href={`/bookings/${b.id}`} className="btn btn-ghost btn-sm">
            Back to Booking
          </Link>
        </div>
        <ExtraExpensesSection bookingId={b.id} />
      </div>
    );
  }

  // Confirmed / Tentative / Enquiry: full edit + extras
  return (
    <div>
      <BookingForm mode="edit" initial={b} />
      {(b.status === "Confirmed" || b.status === "Tentative") && (
        <div style={{ padding: "0 24px 24px" }}>
          <ExtraExpensesSection bookingId={b.id} />
        </div>
      )}
    </div>
  );
}
