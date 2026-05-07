"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import { ROOMS, USERS, FORM_FIELDS } from "@/lib/data";

type Tab = "pricing" | "discount" | "gst" | "users" | "fields";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "pricing", icon: "💰", label: "Pricing Master" },
  { id: "discount", icon: "🏷", label: "Discount Rules" },
  { id: "gst", icon: "📊", label: "GST Config" },
  { id: "users", icon: "👥", label: "Users" },
  { id: "fields", icon: "🗂", label: "Form Fields" },
];

export default function SettingsPage() {
  const { showNotif } = useApp();
  const [tab, setTab] = useState<Tab>("pricing");

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Settings</h2>
          <p>Configure pricing, discounts, GST, users and form fields</p>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-nav">
          {TABS.map((t) => (
            <div
              key={t.id}
              className={`settings-nav-item${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span> {t.label}
            </div>
          ))}
        </div>

        <div>
          {tab === "pricing" && (
            <div className="settings-panel">
              <div className="sp-hd">
                <h3>Room Pricing Master</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => showNotif("Pricing saved successfully", "success")}
                >
                  Save Changes
                </button>
              </div>
              <div className="sp-body">
                <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
                  All booking forms pull prices from here. Changes apply immediately to new bookings.
                </p>
                <table className="pricing-tbl">
                  <thead>
                    <tr><th>Room Type</th><th>Weekday (₹)</th><th>Weekend (₹)</th><th>GST</th></tr>
                  </thead>
                  <tbody>
                    {ROOMS.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>{r.name}</td>
                        <td><input type="number" defaultValue={r.wd} /></td>
                        <td><input type="number" defaultValue={r.wknd} /></td>
                        <td>{r.gst}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--t3)", margin: "14px 0 10px" }}>
                  Packages
                </div>
                <table className="pricing-tbl">
                  <thead>
                    <tr><th>Package</th><th>Rate (₹)</th><th>Per</th><th>GST</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Meal &amp; Activity Package</td>
                      <td><input type="number" defaultValue={2100} /></td>
                      <td>adult / night</td>
                      <td>18%</td>
                    </tr>
                    <tr>
                      <td>Pet Package</td>
                      <td><input type="number" defaultValue={1200} /></td>
                      <td>pet / night</td>
                      <td>18%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "discount" && (
            <div className="settings-panel">
              <div className="sp-hd">
                <h3>Discount Rules by Role</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => showNotif("Discount rules saved", "success")}
                >
                  Save Changes
                </button>
              </div>
              <div className="sp-body">
                <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 18 }}>
                  Employees cannot exceed their ceiling. System enforces this on the booking form.
                </p>
                <div className="disc-role-row">
                  <div>
                    <div className="disc-role-name">Sales REX</div>
                    <div className="disc-role-sub">Front-line sales team</div>
                  </div>
                  <div className="disc-inp"><input type="number" defaultValue={15} /> %</div>
                </div>
                <div className="disc-role-row">
                  <div>
                    <div className="disc-role-name">Manager</div>
                    <div className="disc-role-sub">Property operations manager</div>
                  </div>
                  <div className="disc-inp"><input type="number" defaultValue={25} /> %</div>
                </div>
                <div className="disc-role-row" style={{ borderBottom: "none" }}>
                  <div>
                    <div className="disc-role-name">Admin / Owner</div>
                    <div className="disc-role-sub">No limit</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--grn)" }}>Unlimited</div>
                </div>
              </div>
            </div>
          )}

          {tab === "gst" && (
            <div className="settings-panel">
              <div className="sp-hd">
                <h3>GST Configuration</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => showNotif("GST config saved", "success")}
                >
                  Save Changes
                </button>
              </div>
              <div className="sp-body">
                <div className="gst-row">
                  <span>Standard Rooms (Tent, Couple, Family)</span>
                  <div className="gst-inp"><input type="number" defaultValue={5} /> %</div>
                </div>
                <div className="gst-row">
                  <span>Villas (1BHK, 2BHK, Garden View)</span>
                  <div className="gst-inp"><input type="number" defaultValue={18} /> %</div>
                </div>
                <div className="gst-row">
                  <span>Pool Villa</span>
                  <div className="gst-inp"><input type="number" defaultValue={18} /> %</div>
                </div>
                <div className="gst-row">
                  <span>Meal &amp; Activity Package</span>
                  <div className="gst-inp"><input type="number" defaultValue={18} /> %</div>
                </div>
                <div className="gst-row" style={{ borderBottom: "none" }}>
                  <span>Pet Package</span>
                  <div className="gst-inp"><input type="number" defaultValue={18} /> %</div>
                </div>
              </div>
            </div>
          )}

          {tab === "users" && (
            <div className="settings-panel">
              <div className="sp-hd">
                <h3>User Management</h3>
                <button className="btn btn-primary btn-sm">＋ Add User</button>
              </div>
              <div className="sp-body">
                {USERS.map((u) => (
                  <div key={u.email} className="user-item">
                    <div className="user-av" style={{ background: u.color }}>{u.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div className="user-name">{u.name}</div>
                      <div className="user-email">{u.email}</div>
                    </div>
                    <div className="user-role-tag">{u.role}</div>
                    <button className="btn btn-ghost btn-xs">Edit</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "fields" && (
            <div className="settings-panel">
              <div className="sp-hd">
                <h3>Form Fields — B2C Booking</h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => showNotif("Fields saved", "success")}
                >
                  Save Fields
                </button>
              </div>
              <div className="sp-body">
                <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 16 }}>
                  Drag to reorder. Toggle required / optional. Add custom fields as needed.
                </p>
                <div>
                  {FORM_FIELDS.map((f) => (
                    <div key={f.name} className="field-item">
                      <span className="field-drag">⠿</span>
                      <span className="field-name">{f.name}</span>
                      <span className={`badge ${f.required ? "bd-active" : "bd-draft"}`} style={{ fontSize: 9 }}>
                        {f.required ? "Required" : "Optional"}
                      </span>
                      <button className="btn btn-ghost btn-xs">Edit</button>
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
                >
                  ＋ Add Custom Field
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
