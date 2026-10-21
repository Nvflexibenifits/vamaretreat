"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { extraHead, fmt, fmtIN } from "@/lib/utils";
import type { Booking, Extra } from "@/types";

const PAID_MODES = ["Cash", "Bank Transfer", "Credit Card"];

// Add-on charges the front office posts to a guest's bill: from the room
// chart popup during the stay, or from the booking page afterwards. Only rows
// posted this way can be changed here; rows sales entered on the booking form
// are listed but edited through the form.
//
// Charges can be added to a confirmed or completed booking. Rows can still be
// corrected or removed on a cancelled booking, since a double posting may
// only surface after the guest has left with a credit note.
export function AddOnChargesPanel({
  booking: b,
  today,
  heading = true,
}: {
  booking: Booking;
  today: string;
  heading?: boolean;
}) {
  const { currentRole, currentUser, addOnCategories, addExtra, updateExtra, removeExtra, showNotif } = useApp();

  const canManage = currentRole === "Front Office" || currentRole === "Sales" || currentRole === "Admin";
  const canAdd = canManage && (b.status === "Confirmed" || b.status === "Completed");
  const canEditRows = canAdd || (canManage && b.status === "Cancelled");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [category, setCategory] = useState(addOnCategories[0]?.name ?? "");
  const [amount, setAmount] = useState("");
  const [gstPct, setGstPct] = useState("18");
  const [date, setDate] = useState(today);
  const [paid, setPaid] = useState(false);
  const [payMode, setPayMode] = useState("Cash");
  // Row whose removal is being confirmed, and whether its receipt goes too
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(true);

  const resetForm = () => {
    setEditingId(null);
    setCategory(addOnCategories[0]?.name ?? "");
    setAmount("");
    setGstPct("18");
    setDate(today);
    setPaid(false);
    setPayMode("Cash");
  };
  const startEdit = (e: Extra) => {
    setRemoving(null);
    setEditingId(e.id ?? null);
    setCategory(e.name);
    setAmount(String(e.amount));
    setGstPct(e.amount > 0 && e.gst ? String(Math.round((e.gst / e.amount) * 10000) / 100) : "0");
    setDate(e.date || today);
    const receipt = b.payments.find((p) => p.extraId === e.id);
    setPaid(!!receipt);
    setPayMode(receipt?.mode ?? "Cash");
  };
  const submit = () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      showNotif("Enter the charge amount", "error");
      return;
    }
    const cat = category.trim() || "Add-on Charge";
    const gst = Math.round(amt * (parseFloat(gstPct) || 0)) / 100;
    const head = addOnCategories.find((c) => c.name === cat)?.head ?? extraHead({ name: cat, amount: amt, date: "", by: "" });
    const on = date || today;
    if (editingId) {
      updateExtra(b.id, editingId, { name: cat, amount: amt, gst, head, date: on }, paid ? { mode: payMode, date: on } : null);
      showNotif("Charge updated", "success");
    } else {
      addExtra(
        b.id,
        { name: cat, amount: amt, gst, head, date: on, by: currentUser, source: "front-office" },
        paid ? { mode: payMode, date: on } : undefined
      );
      showNotif(paid ? `${fmt(amt + gst)} charged and received` : `${fmt(amt + gst)} added to the bill`, "success");
    }
    resetForm();
  };
  const confirmRemove = () => {
    if (!removing) return;
    removeExtra(b.id, removing, { keepPayment: !removeReceipt });
    if (editingId === removing) resetForm();
    setRemoving(null);
    showNotif("Charge removed", "success");
  };

  const cn = b.cancellationDetails;
  const label = (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>Add-on charges</div>
  );

  if (!canManage && b.extras.length === 0) return null;

  return (
    <div>
      {heading && label}
      {b.status === "Cancelled" && canManage && (
        <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>
          Booking is cancelled{cn?.creditNoteCode ? ` with credit note ${cn.creditNoteCode} for ${fmt(cn.creditNoteAmount)}` : cn?.refundAmount ? ` with a refund of ${fmt(cn.refundAmount)}` : ""}.
          Correcting a charge here does not change the credit note or refund already recorded.
        </div>
      )}
      {b.extras.length > 0 && (
        <table className="pricing-tbl" style={{ marginBottom: 10 }}>
          <thead>
            <tr>
              <th>Charge</th>
              <th style={{ textAlign: "right" }}>Charges</th>
              <th style={{ textAlign: "right" }}>GST</th>
              <th style={{ textAlign: "right" }}>Total</th>
              <th>Paid</th>
              <th>By</th>
              {canEditRows && <th style={{ width: 110 }}></th>}
            </tr>
          </thead>
          <tbody>
            {b.extras.map((e, i) => {
              const mine = e.source === "front-office" && !!e.id;
              const receipt = b.payments.find((p) => p.extraId === e.id);
              const isPaid = receipt ? true : (e.totalPaid ?? 0) >= (e.amount || 0) + (e.gst || 0);
              const gross = (e.amount || 0) + (e.gst || 0);
              const isRemoving = removing != null && removing === e.id;
              return (
                <tr key={e.id ?? i}>
                  <td>
                    {e.name}
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>{fmtIN(e.date)}</div>
                  </td>
                  <td style={{ textAlign: "right" }}>{fmt(e.amount || 0)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(e.gst || 0)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--t1)" }}>{fmt(gross)}</td>
                  <td>
                    <span className="badge" style={{ fontSize: 10, background: isPaid ? "var(--grn-lt)" : "var(--amb-lt)", color: isPaid ? "var(--grn)" : "var(--amb)" }}>
                      {isPaid ? `Paid${receipt ? ` · ${receipt.mode}` : ""}` : "Unpaid"}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--t3)" }}>{e.by}</td>
                  {canEditRows && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      {mine ? (
                        isRemoving ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                            <span style={{ fontSize: 11, color: "var(--t1)", fontWeight: 600 }}>Remove this charge?</span>
                            {receipt && (
                              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--t2)", cursor: "pointer", whiteSpace: "normal" }}>
                                <input type="checkbox" checked={removeReceipt} onChange={(ev) => setRemoveReceipt(ev.target.checked)} />
                                Also remove the {receipt.mode} receipt of {fmt(receipt.amount)}
                              </label>
                            )}
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" className="btn btn-danger btn-xs" onClick={confirmRemove}>Remove</button>
                              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setRemoving(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => startEdit(e)}>Edit</button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              style={{ color: "var(--red)" }}
                              onClick={() => { setRemoving(e.id!); setRemoveReceipt(true); }}
                            >
                              Remove
                            </button>
                          </>
                        )
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>Booking form</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
        </tbody>
        </table>
      )}

      {canAdd || (editingId && canEditRows) ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr .7fr 1fr 1fr", gap: 8, alignItems: "end" }}>
            <div className="field">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {addOnCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                {category && !addOnCategories.some((c) => c.name === category) && <option value={category}>{category}</option>}
              </select>
            </div>
            <div className="field">
              <label>Amount (₹)</label>
              <input type="number" min={0} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <label>GST %</label>
              <input type="number" min={0} max={28} value={gstPct} onChange={(e) => setGstPct(e.target.value)} />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Payment</label>
              <select value={paid ? "paid" : "unpaid"} onChange={(e) => setPaid(e.target.value === "paid")}>
                <option value="unpaid">Unpaid · add to bill</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          {paid && (
            <div className="field" style={{ marginTop: 8, maxWidth: 220 }}>
              <label>Received by</label>
              <select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                {PAID_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={submit}>
              {editingId ? "Save charge" : "Add charge"}
            </button>
            {editingId && <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel edit</button>}
            <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>
              Total {fmt((parseFloat(amount) || 0) * (1 + (parseFloat(gstPct) || 0) / 100))}
            </span>
          </div>
        </>
      ) : canManage && !canEditRows ? (
        <div style={{ fontSize: 12, color: "var(--t3)" }}>
          Add-on charges can be added to confirmed or completed bookings only.
        </div>
      ) : null}
    </div>
  );
}
