"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { addDays, cashOfPayments, extraHead, fmt, fmtIN, nowTime, todayStr, signedBalance, tdsOfPayments } from "@/lib/utils";
import { REFUND_TYPE } from "@/types";
import type {
  B2BBooking,
  B2BBookingType,
  B2BStatus,
  B2BType,
  ChargeHead,
  Extra,
  Payment,
} from "@/types";

// Short code used in the booking ID, e.g. B2B-Corp-26-001
const TYPE_CODE: Record<B2BType, string> = {
  Corporate: "Corp",
  School: "Sch",
  Institute: "Inst",
};

// The org-name field is labelled after the type it belongs to
const ORG_LABEL: Record<B2BType, string> = {
  Corporate: "Company Name",
  School: "School Name",
  Institute: "Institute Name",
};

const PAYMENT_MODES = ["Bank Transfer", "Cash", "UPI", "Card", "Cheque"];

type AddOnRow = {
  uid: string;
  category: string;
  amount: string;
  gstPct: string;
  date?: string;
  by?: string;
};

type PaymentRow = { uid: string; date: string; amount: string; tds: string; mode: string; kind?: "refund" };

type FieldErrors = Partial<
  Record<"orgName" | "contactPerson" | "contactNumber" | "checkin" | "checkout", boolean>
>;

let uidCounter = 0;
const newUid = () => `b2b-${Date.now().toString(36)}-${uidCounter++}`;

export function B2BBookingForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: B2BBooking;
}) {
  const router = useRouter();
  const {
    b2bBookings,
    createB2BBooking,
    updateB2BBooking,
    addOnCategories,
    showNotif,
    currentUser,
  } = useApp();

  const isEdit = mode === "edit" && !!initial;
  const todayDate = typeof window !== "undefined" ? todayStr() : "";

  // ─── Section 1: organisation and contacts ───
  const [type, setType] = useState<B2BType>(initial?.type ?? "Corporate");
  const [orgName, setOrgName] = useState(initial?.orgName ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson ?? "");
  const [contactNumber, setContactNumber] = useState(initial?.contactNumber ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [tagName, setTagName] = useState(initial?.tagName ?? "");
  const [tagContactName, setTagContactName] = useState(initial?.tagContactName ?? "");
  const [tagContactNumber, setTagContactNumber] = useState(initial?.tagContactNumber ?? "");
  const [tagEmail, setTagEmail] = useState(initial?.tagEmail ?? "");

  // ─── Section 2: stay ───
  const [bookingType, setBookingType] = useState<B2BBookingType>(
    initial?.bookingType ?? "Dayout"
  );
  const [checkin, setCheckin] = useState(initial?.checkin ?? todayDate);
  const [checkout, setCheckout] = useState(
    initial?.checkout ?? (todayDate ? addDays(todayDate, 1) : "")
  );
  const [pax, setPax] = useState(initial ? String(initial.pax || "") : "");

  // ─── Section 3: add-on charges ───
  const [addOnRows, setAddOnRows] = useState<AddOnRow[]>(() =>
    (initial?.extras ?? []).map((e) => ({
      uid: newUid(),
      category: e.name,
      amount: String(e.amount),
      gstPct:
        e.amount > 0 && e.gst ? String(Math.round((e.gst / e.amount) * 10000) / 100) : "0",
      date: e.date,
      by: e.by,
    }))
  );

  // ─── Section 5: payments ───
  // Receipts already recorded, editable on this form. Refund rows stay as
  // they are: they document money already handed back.
  const [existingPayments, setExistingPayments] = useState<Payment[]>(initial?.payments ?? []);
  const [newPaymentRows, setNewPaymentRows] = useState<PaymentRow[]>([
    { uid: newUid(), date: todayDate, amount: "", tds: "", mode: "Bank Transfer" },
  ]);

  const [errors, setErrors] = useState<FieldErrors>({});

  // A category renamed or removed in Master Setup must not silently reassign a
  // charge already saved on this booking, so keep its own value as an option.
  const addOnCategoryOptions = (current: string): string[] => {
    const labels = addOnCategories.map((c) => c.name);
    return current && !labels.includes(current) ? [current, ...labels] : labels;
  };

  // ─── Totals ───
  const addOnTotals = addOnRows.map((r) => {
    const amt = parseFloat(r.amount) || 0;
    const gstAmt = (amt * (parseFloat(r.gstPct) || 0)) / 100;
    return { amt, gstAmt, total: amt + gstAmt };
  });
  const totalAddOnBasic = addOnTotals.reduce((s, r) => s + r.amt, 0);
  const totalAddOnGst = addOnTotals.reduce((s, r) => s + r.gstAmt, 0);
  const grandTotal = addOnTotals.reduce((s, r) => s + r.total, 0);

  const builtExtras: Extra[] = addOnRows
    .map((r) => {
      const amt = parseFloat(r.amount) || 0;
      const category = r.category.trim();
      return {
        name: category || "Add-on Charge",
        amount: amt,
        gst: (amt * (parseFloat(r.gstPct) || 0)) / 100,
        date: r.date || todayDate,
        by: r.by || currentUser,
        // Persist the revenue head so the register never guesses from the label
        head: (addOnCategories.find((c) => c.name === category)?.head ??
          extraHead({ name: category, amount: amt, date: "", by: "" })) as ChargeHead,
      };
    })
    .filter((e) => e.amount > 0);

  // Refund rows hand money back, so they count against what was received.
  const newAdvance = newPaymentRows.reduce(
    (s, r) => s + (parseFloat(r.amount) || 0) * (r.kind === "refund" ? -1 : 1),
    0
  );
  // Cash and bank actually received, net of refunds. TDS is tracked beside
  // it, not inside it.
  const existingAdvance = cashOfPayments(existingPayments);
  const totalReceived = existingAdvance + newAdvance;
  // TDS the client withheld from each payment. Settles the bill like the
  // payment itself but never arrives as cash.
  const existingTds = tdsOfPayments(existingPayments);
  const newTds = newPaymentRows
    .filter((r) => r.kind !== "refund")
    .reduce((s, r) => s + Math.max(0, parseFloat(r.tds) || 0), 0);
  const totalTds = existingTds + newTds;
  // Signed: negative means the organisation has settled more than the bill.
  const balance = signedBalance(grandTotal, totalReceived + totalTds);

  // ─── Validation ───
  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!orgName.trim()) errs.orgName = true;
    if (!contactPerson.trim()) errs.contactPerson = true;
    const digits = contactNumber.trim().replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 14) errs.contactNumber = true;
    if (!checkin) errs.checkin = true;
    if (bookingType === "Overnight" && (!checkout || checkout <= checkin)) {
      errs.checkout = true;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showNotif("Fill the highlighted fields", "error");
      return false;
    }
    return true;
  };

  // ─── Save ───
  const save = (intent: B2BStatus) => {
    if (!validate()) return;
    // Money received means a firm commitment — only Confirm is allowed then
    if (intent !== "Confirmed" && newAdvance > 0) {
      showNotif("Payment entered — use Confirm Booking", "error");
      return;
    }

    // A dayout blocks a single date, so checkout mirrors check-in
    const effCheckout = bookingType === "Dayout" ? checkin : checkout;

    const builtPayments: Payment[] = newPaymentRows
      .map((r) => {
        const amt = Math.abs(parseFloat(r.amount) || 0);
        if (r.kind === "refund") {
          return { date: r.date || todayDate, time: nowTime(), type: REFUND_TYPE, amount: -amt, mode: r.mode, by: currentUser };
        }
        const tds = Math.max(0, parseFloat(r.tds) || 0);
        return {
          date: r.date || todayDate,
          time: nowTime(),
          type: "Advance",
          amount: amt,
          mode: r.mode,
          by: currentUser,
          ...(tds > 0 ? { tds } : {}),
        };
      })
      // A payment settled entirely by TDS still counts
      .filter((p) => p.amount !== 0 || (p.tds ?? 0) > 0);

    const payments = [...existingPayments, ...builtPayments];
    // Amount received is cash and bank only, net of refunds; TDS settles the
    // balance but never arrives as money.
    const tds = tdsOfPayments(payments);
    const advance = cashOfPayments(payments);

    const common = {
      type,
      orgName: orgName.trim(),
      contactPerson: contactPerson.trim(),
      contactNumber: contactNumber.trim(),
      email: email.trim(),
      tagName: tagName.trim(),
      tagContactName: tagContactName.trim(),
      tagContactNumber: tagContactNumber.trim(),
      tagEmail: tagEmail.trim(),
      bookingType,
      checkin,
      checkout: effCheckout,
      pax: parseInt(pax) || 0,
      extras: builtExtras,
      grandTotal,
      payments,
      advance,
      balance: signedBalance(grandTotal, advance + tds),
      status: intent,
    };

    if (isEdit) {
      updateB2BBooking(initial!.id, common);
      showNotif(`${initial!.id} updated`, "success");
      router.push(`/b2b/${initial!.id}`);
      return;
    }

    // B2B-<type code>-<2-digit year>-<sequence>, sequence per type per year.
    // Highest existing number for the prefix + 1, so deletions never reuse IDs.
    const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
    const idPrefix = `B2B-${TYPE_CODE[type]}-${yy}-`;
    const maxSeq = b2bBookings
      .filter((b) => b.id.startsWith(idPrefix))
      .reduce((m, b) => Math.max(m, parseInt(b.id.slice(idPrefix.length), 10) || 0), 0);
    const id = idPrefix + String(maxSeq + 1).padStart(3, "0");

    const booking: B2BBooking = {
      id,
      ...common,
      createdBy: currentUser,
      createdAt: new Date().toISOString(),
    };
    createB2BBooking(booking);
    showNotif(
      intent === "Confirmed"
        ? `${id} confirmed`
        : intent === "Tentative"
        ? `${id} saved as tentative`
        : `${id} saved as enquiry`,
      "success"
    );
    router.push(`/b2b/${id}`);
  };

  const cellInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 8px",
    border: "1px solid var(--bd)",
    borderRadius: "var(--r3)",
    fontSize: 12,
    textAlign: "right",
    background: "var(--surf)",
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 8px",
    border: "1px solid var(--bd)",
    borderRadius: "var(--r3)",
    fontSize: 12,
    background: "var(--surf)",
    outline: "none",
  };

  return (
    <>
      {/* §1 Booking Details */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">1</span>Booking Details
          </div>
          <div className="fg">
            <div className="field">
              <label>Type *</label>
              <select value={type} onChange={(e) => setType(e.target.value as B2BType)}>
                <option>Corporate</option>
                <option>School</option>
                <option>Institute</option>
              </select>
            </div>
            <div className={`field${errors.orgName ? " error" : ""}`}>
              <label>{ORG_LABEL[type]} *</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={`e.g. ${type === "School" ? "Delhi Public School" : type === "Institute" ? "IIM Bangalore" : "Infosys Ltd"}`}
              />
            </div>
            <div className={`field${errors.contactPerson ? " error" : ""}`}>
              <label>Contact Person Name *</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className={`field${errors.contactNumber ? " error" : ""}`}>
              <label>Contact Number *</label>
              <input
                type="tel"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="field">
              <label>Email ID</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--bd)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--t3)",
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              TAG Details
            </div>
            <div className="fg">
              <div className="field">
                <label>TAG Name</label>
                <input
                  type="text"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="Travel agent / partner"
                />
              </div>
              <div className="field">
                <label>TAG Contact Name</label>
                <input
                  type="text"
                  value={tagContactName}
                  onChange={(e) => setTagContactName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="field">
                <label>TAG Contact Number</label>
                <input
                  type="tel"
                  value={tagContactNumber}
                  onChange={(e) => setTagContactNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="field">
                <label>TAG Email ID</label>
                <input
                  type="email"
                  value={tagEmail}
                  onChange={(e) => setTagEmail(e.target.value)}
                  placeholder="name@agency.com"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* §2 Stay Details */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">2</span>Stay Details
          </div>
          <div className="fg">
            <div className="field">
              <label>Booking Type *</label>
              <select
                value={bookingType}
                onChange={(e) => setBookingType(e.target.value as B2BBookingType)}
              >
                <option value="Dayout">Day Out</option>
                <option value="Overnight">Overnight</option>
              </select>
            </div>
            <div className={`field${errors.checkin ? " error" : ""}`}>
              <label>{bookingType === "Dayout" ? "Date *" : "Check-in *"}</label>
              <input
                type="date"
                value={checkin}
                onChange={(e) => {
                  setCheckin(e.target.value);
                  // Keep check-out ahead of check-in as the date moves
                  if (bookingType === "Overnight" && e.target.value && checkout <= e.target.value) {
                    setCheckout(addDays(e.target.value, 1));
                  }
                }}
              />
            </div>
            {bookingType === "Overnight" && (
              <div className={`field${errors.checkout ? " error" : ""}`}>
                <label>Check-out *</label>
                <input
                  type="date"
                  value={checkout}
                  onChange={(e) => setCheckout(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label>Pax Count</label>
              <input
                type="number"
                min={0}
                value={pax}
                onChange={(e) => setPax(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* §3 Add-on Charges */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">3</span>Add-on Charges
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: 12 }}
            onClick={() =>
              setAddOnRows((prev) => [
                ...prev,
                {
                  uid: newUid(),
                  category: addOnCategories[0]?.name ?? "",
                  amount: "0",
                  gstPct: "0",
                },
              ])
            }
          >
            Add Row
          </button>

          {addOnRows.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--t3)" }}>
              No add on charges. Click Add Row to add charges.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: "nowrap" }}>Category</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Amount (₹)</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST %</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST Amt</th>
                    <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Total</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {addOnRows.map((row, i) => {
                    const t = addOnTotals[i];
                    return (
                      <tr key={row.uid} style={{ cursor: "default" }}>
                        <td style={{ verticalAlign: "middle" }}>
                          <select
                            value={row.category}
                            onChange={(e) =>
                              setAddOnRows((prev) =>
                                prev.map((r) =>
                                  r.uid === row.uid ? { ...r, category: e.target.value } : r
                                )
                              )
                            }
                            style={selectStyle}
                          >
                            {addOnCategoryOptions(row.category).map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <input
                            type="number"
                            value={row.amount}
                            min={0}
                            onChange={(e) =>
                              setAddOnRows((prev) =>
                                prev.map((r) =>
                                  r.uid === row.uid ? { ...r, amount: e.target.value } : r
                                )
                              )
                            }
                            style={cellInputStyle}
                          />
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <input
                            type="number"
                            value={row.gstPct}
                            min={0}
                            max={28}
                            onChange={(e) =>
                              setAddOnRows((prev) =>
                                prev.map((r) =>
                                  r.uid === row.uid ? { ...r, gstPct: e.target.value } : r
                                )
                              )
                            }
                            style={cellInputStyle}
                          />
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                          {fmt(t.gstAmt)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            verticalAlign: "middle",
                            fontWeight: 700,
                          }}
                        >
                          {fmt(t.total)}
                        </td>
                        <td style={{ verticalAlign: "middle" }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() =>
                              setAddOnRows((prev) => prev.filter((r) => r.uid !== row.uid))
                            }
                            title="Remove row"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* §4 Amount Due */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">4</span>Amount Due
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Items</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Basic Amount</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>GST Amount</th>
                  <th style={{ whiteSpace: "nowrap", textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {addOnRows.length === 0 ? (
                  <tr style={{ cursor: "default" }}>
                    <td colSpan={4} style={{ color: "var(--t3)", fontSize: 12 }}>
                      No charges added yet
                    </td>
                  </tr>
                ) : (
                  <tr style={{ cursor: "default" }}>
                    <td>Add-on Charges</td>
                    <td style={{ textAlign: "right" }}>{fmt(totalAddOnBasic)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(totalAddOnGst)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(grandTotal)}</td>
                  </tr>
                )}
                <tr style={{ cursor: "default", background: "var(--surf2)" }}>
                  <td style={{ fontWeight: 700 }}>Amount Due</td>
                  <td style={{ textAlign: "right", color: "var(--t3)" }}>—</td>
                  <td style={{ textAlign: "right", color: "var(--t3)" }}>—</td>
                  <td style={{ textAlign: "right", fontWeight: 800, fontSize: 15 }}>
                    {fmt(grandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* §5 Payment Received */}
      <div className="form-panel">
        <div className="form-sec">
          <div className="form-sec-title">
            <span className="form-sec-num">5</span>Payment Received
          </div>

          {isEdit && existingPayments.length > 0 && (
            <table className="pricing-tbl" style={{ marginBottom: 14 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th style={{ textAlign: "right" }}>Amount (₹)</th>
                  <th style={{ textAlign: "right" }}>TDS (₹)</th>
                  <th style={{ textAlign: "right" }}>Cumulative (₹)</th>
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let running = 0;
                  return existingPayments.map((p, i) => {
                    running += p.amount;
                    const isRefund = p.type === REFUND_TYPE || p.amount < 0;
                    const editable = !isRefund;
                    const upd = (patch: Partial<Payment>) =>
                      setExistingPayments((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                      <tr key={i} style={{ cursor: "default" }}>
                        <td>
                          {isRefund && <span className="badge" style={{ fontSize: 10, background: "var(--pur-bg)", color: "var(--pur)", marginRight: 6 }}>Refund</span>}
                          {editable ? (
                            <input type="date" value={p.date} onChange={(e) => upd({ date: e.target.value })} />
                          ) : (
                            fmtIN(p.date)
                          )}
                        </td>
                        <td>
                          {editable ? (
                            <select value={p.mode} onChange={(e) => upd({ mode: e.target.value })}>
                              {PAYMENT_MODES.map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                            </select>
                          ) : (
                            p.mode
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {editable ? (
                            <input
                              type="number"
                              min={0}
                              value={p.amount === 0 ? "" : p.amount}
                              placeholder="0"
                              onChange={(e) => upd({ amount: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: "right" }}
                            />
                          ) : (
                            <span style={{ color: "var(--pur)" }}>−{fmt(-p.amount)}</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--t3)" }}>
                          {editable ? (
                            <input
                              type="number"
                              min={0}
                              value={(p.tds ?? 0) === 0 ? "" : p.tds}
                              placeholder="0"
                              onChange={(e) => {
                                const v = Math.max(0, parseFloat(e.target.value) || 0);
                                upd({ tds: v > 0 ? v : undefined });
                              }}
                              style={{ textAlign: "right" }}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{fmt(running)}</td>
                        <td>
                          {editable && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => setExistingPayments((prev) => prev.filter((_, j) => j !== i))}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          )}

          <table className="pricing-tbl" style={{ marginBottom: 8 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount (₹)</th>
                <th title="Withheld by the client from this payment and remitted to the government. Settles the bill but is not cash received.">TDS (₹)</th>
                <th>Mode</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {newPaymentRows.map((row) => (
                <tr key={row.uid} style={row.kind === "refund" ? { background: "var(--pur-lt)" } : undefined}>
                  <td>
                    {row.kind === "refund" && (
                      <span className="badge" style={{ fontSize: 10, background: "var(--pur-bg)", color: "var(--pur)", marginRight: 6 }}>Refund</span>
                    )}
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) =>
                        setNewPaymentRows((prev) =>
                          prev.map((r) =>
                            r.uid === row.uid ? { ...r, date: e.target.value } : r
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) =>
                        setNewPaymentRows((prev) =>
                          prev.map((r) =>
                            r.uid === row.uid ? { ...r, amount: e.target.value } : r
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    {row.kind === "refund" ? (
                      <span style={{ color: "var(--t3)" }}>—</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={row.tds}
                        onChange={(e) =>
                          setNewPaymentRows((prev) =>
                            prev.map((r) =>
                              r.uid === row.uid ? { ...r, tds: e.target.value } : r
                            )
                          )
                        }
                      />
                    )}
                  </td>
                  <td>
                    <select
                      value={row.mode}
                      onChange={(e) =>
                        setNewPaymentRows((prev) =>
                          prev.map((r) =>
                            r.uid === row.uid ? { ...r, mode: e.target.value } : r
                          )
                        )
                      }
                    >
                      {PAYMENT_MODES.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {newPaymentRows.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() =>
                          setNewPaymentRows((prev) => prev.filter((r) => r.uid !== row.uid))
                        }
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setNewPaymentRows((prev) => [
                  ...prev,
                  { uid: newUid(), date: todayDate, amount: "", tds: "", mode: "Bank Transfer" },
                ])
              }
            >
              Add Payment
            </button>
            {isEdit && balance <= -1 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: "var(--pur)" }}
                title="Record money handed back for the excess received"
                onClick={() =>
                  setNewPaymentRows((prev) => [
                    ...prev,
                    { uid: newUid(), date: todayDate, amount: String(-balance), tds: "", mode: "Bank Transfer", kind: "refund" },
                  ])
                }
              >
                Record Refund of {fmt(-balance)}
              </button>
            )}
          </div>

          <div className="detail-row" style={{ marginTop: 16 }}>
            <span className="detail-key" style={{ fontWeight: 600 }}>
              Total Payment Received
            </span>
            <span className="detail-val" style={{ fontWeight: 800, fontSize: 16 }}>
              {fmt(totalReceived)}
            </span>
          </div>
          {totalTds > 0 && (
            <div className="detail-row">
              <span className="detail-key" style={{ fontWeight: 600 }}>TDS</span>
              <span className="detail-val" style={{ fontWeight: 700, fontSize: 14, color: "var(--t2)" }}>
                {fmt(totalTds)}
              </span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-key" style={{ fontWeight: 600 }}>
              {balance <= -1 ? "Excess Received" : "Balance"}
            </span>
            <span
              className="detail-val"
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: balance >= 1 ? "var(--amb)" : balance <= -1 ? "var(--pur)" : "var(--grn)",
              }}
            >
              {fmt(Math.abs(balance))}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 18,
          marginBottom: 30,
        }}
      >
        <button className="btn btn-ghost" onClick={() => router.back()}>
          Cancel
        </button>
        <button className="btn btn-ghost" onClick={() => save("Enquiry")}>
          Save as Enquiry
        </button>
        <button className="btn btn-ghost" onClick={() => save("Tentative")}>
          Book Tentatively
        </button>
        <button className="btn btn-primary" onClick={() => save("Confirmed")}>
          Confirm Booking
        </button>
      </div>
    </>
  );
}
