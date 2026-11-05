"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { amountDue, depositApplied, depositHeld, depositReceived, depositRefunded, fmt, fmtIN } from "@/lib/utils";
import type { Booking } from "@/types";

const DEPOSIT_MODES = ["Bank Transfer", "Cash", "Credit Card", "Cheque"];
const REFUND_MODES = ["Bank Transfer", "Cash", "Cheque"];

// Security deposit on a group booking, shown on the booking page. The deposit
// is held apart from the bill: taking one never touches Amount Received or
// the balance. Settle Deposit squares it off after the stay: any unpaid
// balance is taken from it (landing on the bill as a Deposit Applied
// payment) and the rest is refunded.
export function SecurityDepositPanel({ booking: b, today }: { booking: Booking; today: string }) {
  const { currentRole, currentUser, addDeposit, removeDeposit, settleDeposit, showNotif } = useApp();
  const canManage = currentRole === "Front Office" || currentRole === "Sales" || currentRole === "Admin";
  const settled = b.deposit?.settlement ?? null;
  const entries = b.deposit?.entries ?? [];
  const received = depositReceived(b);
  const held = depositHeld(b);
  const canAdd = canManage && !settled && (b.status === "Tentative" || b.status === "Confirmed" || b.status === "Completed");
  const canSettle = canManage && !settled && held > 0 && (b.status === "Confirmed" || b.status === "Completed" || b.status === "Cancelled");

  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Bank Transfer");

  const [settling, setSettling] = useState(false);
  const [settleDate, setSettleDate] = useState(today);
  const [refundMode, setRefundMode] = useState("Bank Transfer");
  const [reference, setReference] = useState("");

  const submitAdd = () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      showNotif("Enter the deposit amount", "error");
      return;
    }
    addDeposit(b.id, { id: `dep-${Math.random().toString(36).slice(2, 9)}`, date: date || today, amount: amt, mode, by: currentUser });
    showNotif(`Security deposit of ${fmt(amt)} recorded`, "success");
    setAdding(false);
    setAmount("");
    setDate(today);
    setMode("Bank Transfer");
  };

  // What settlement would do right now: the unpaid balance comes out of the
  // deposit first, the remainder goes back to the guest.
  const due = amountDue(b.balance);
  const applied = Math.min(held, due);
  const refund = held - applied;

  const submitSettle = () => {
    settleDeposit(b.id, { date: settleDate || today, applied, refunded: refund, refundMode, ...(reference.trim() ? { reference: reference.trim() } : {}) });
    showNotif(
      applied > 0 && refund > 0
        ? `${fmt(applied)} applied to the bill, ${fmt(refund)} refunded`
        : applied > 0
        ? `${fmt(applied)} applied to the bill`
        : `${fmt(refund)} refunded`,
      "success"
    );
    setSettling(false);
  };

  if (!canManage && entries.length === 0) return null;
  if (entries.length === 0 && !canAdd) return null;

  const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".5px" };

  return (
    <div style={{ padding: "10px 16px 12px", borderBottom: "1px solid var(--bd)", background: "var(--acc-lt)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: entries.length > 0 ? 6 : 0 }}>
        <span style={label}>Security Deposit</span>
        <span style={{ fontSize: 11, color: "var(--t3)" }}>held apart from the bill, not a receipt</span>
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: settled ? "var(--t2)" : "var(--acc)" }}>
          {settled ? `Settled · ${fmt(received)} received` : held > 0 ? `${fmt(held)} held` : "None held"}
        </span>
      </div>

      {entries.map((e) => (
        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "3px 0", fontSize: 12 }}>
          <span style={{ color: "var(--t2)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="badge" style={{ fontSize: 10, background: "var(--surf)", color: "var(--acc)" }}>{e.mode}</span>
            <span>Deposit received</span>
            <span style={{ color: "var(--t3)" }}>{fmtIN(e.date)}{e.by ? ` · by ${e.by}` : ""}</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 600, color: "var(--t1)" }}>{fmt(e.amount)}</span>
            {canAdd && (
              <button type="button" className="btn btn-ghost btn-xs" style={{ color: "var(--red)" }} onClick={() => { removeDeposit(b.id, e.id); showNotif("Deposit entry removed", "success"); }}>
                Remove
              </button>
            )}
          </span>
        </div>
      ))}

      {settled && (
        <div style={{ marginTop: 6, fontSize: 12, color: "var(--t2)" }}>
          {settled.applied > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>Applied to the bill <span style={{ color: "var(--t3)" }}>{fmtIN(settled.date)} · by {settled.by}</span></span>
              <span style={{ fontWeight: 600, color: "var(--t1)" }}>{fmt(depositApplied(b))}</span>
            </div>
          )}
          {settled.refunded > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span>
                Refunded by {settled.refundMode}
                <span style={{ color: "var(--t3)" }}> {fmtIN(settled.date)} · by {settled.by}{settled.reference ? ` · ${settled.reference}` : ""}</span>
              </span>
              <span style={{ fontWeight: 600, color: "var(--pur)" }}>−{fmt(depositRefunded(b))}</span>
            </div>
          )}
        </div>
      )}

      {canManage && !settled && (
        <div style={{ marginTop: 8 }}>
          {adding ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field" style={{ width: 150 }}>
                <label>Date</label>
                <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field" style={{ width: 130 }}>
                <label>Amount (₹)</label>
                <input type="number" min={0} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
              </div>
              <div className="field" style={{ width: 150 }}>
                <label>Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  {DEPOSIT_MODES.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={submitAdd}>Save deposit</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          ) : settling ? (
            <div style={{ border: "1px solid var(--bd)", borderRadius: "var(--r2)", background: "var(--surf)", padding: "10px 12px" }}>
              <div style={{ ...label, marginBottom: 6 }}>Settle deposit</div>
              <div style={{ fontSize: 12, color: "var(--t2)", display: "grid", gridTemplateColumns: "1fr auto", rowGap: 4, columnGap: 16 }}>
                <span>Deposit held</span><span style={{ fontWeight: 600, color: "var(--t1)", textAlign: "right" }}>{fmt(held)}</span>
                <span>Unpaid balance on the bill</span><span style={{ fontWeight: 600, color: due > 0 ? "var(--amb)" : "var(--t3)", textAlign: "right" }}>{due > 0 ? fmt(due) : "Nil"}</span>
                <span>Taken from the deposit to settle the bill</span><span style={{ fontWeight: 600, color: "var(--t1)", textAlign: "right" }}>{applied > 0 ? fmt(applied) : "—"}</span>
                <span style={{ fontWeight: 700, color: "var(--t1)" }}>Refund to the guest</span><span style={{ fontWeight: 800, color: "var(--pur)", textAlign: "right" }}>{refund > 0 ? fmt(refund) : "Nil"}</span>
              </div>
              {due > held && (
                <div style={{ fontSize: 11, color: "var(--amb)", marginTop: 6 }}>
                  The deposit covers only part of the balance. {fmt(due - held)} stays pending on the bill.
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
                <div className="field" style={{ width: 150 }}>
                  <label>Date</label>
                  <input type="date" value={settleDate} max={today} onChange={(e) => setSettleDate(e.target.value)} />
                </div>
                {refund > 0 && (
                  <>
                    <div className="field" style={{ width: 150 }}>
                      <label>Refund mode</label>
                      <select value={refundMode} onChange={(e) => setRefundMode(e.target.value)}>
                        {REFUND_MODES.map((m) => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="field" style={{ width: 200 }}>
                      <label>Reference</label>
                      <input type="text" value={reference} placeholder="UTR / cheque no. (optional)" onChange={(e) => setReference(e.target.value)} />
                    </div>
                  </>
                )}
                <button type="button" className="btn btn-primary btn-sm" onClick={submitSettle}>Confirm settlement</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSettling(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              {canAdd && (
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => { setAdding(true); setDate(today); }}>
                  + Add deposit
                </button>
              )}
              {canSettle && (
                <button type="button" className="btn btn-primary btn-xs" onClick={() => { setSettling(true); setSettleDate(today); }}>
                  Settle deposit
                </button>
              )}
              {!canSettle && held > 0 && b.status === "Tentative" && (
                <span style={{ fontSize: 11, color: "var(--t3)", alignSelf: "center" }}>Settle after the booking is confirmed or completed.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
