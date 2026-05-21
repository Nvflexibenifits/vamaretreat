"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import {
  SEED_DISCOUNT_CAPS,
  SEED_PACKAGE_RATES,
  ROOMS as SEED_ROOMS,
} from "@/lib/data";
import type {
  CreditNoteSettings,
  DiscountCaps,
  PackageRates,
  Role,
  RoomInventoryItem,
  RoomMaster,
  SpecialDay,
  User,
  Venue,
  VenueType,
} from "@/types";

type Tab =
  | "rooms"
  | "venues"
  | "meal"
  | "discount"
  | "special"
  | "credit"
  | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "rooms", label: "Room Master" },
  { id: "venues", label: "Venue Master" },
  { id: "meal", label: "Meal Package" },
  { id: "discount", label: "Discount Rules" },
  { id: "special", label: "Special Days" },
  { id: "credit", label: "Credit Note Settings" },
  { id: "users", label: "Users" },
];

const VENUE_TYPES: VenueType[] = [
  "Conference Room",
  "Seminar Room",
  "Garden Venue",
  "Event Place",
];

const ROLE_OPTIONS: Role[] = ["Sales REX", "Manager", "Room Allocator", "Admin"];

const COLOR_PALETTE = [
  "#172f24",
  "#5b21b6",
  "#c9873a",
  "#1a4fd6",
  "#0f2318",
  "#8b1538",
  "#1e6f5c",
  "#a04a3f",
];

function colorFor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export default function MasterSetupPage() {
  const [tab, setTab] = useState<Tab>("rooms");

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Master Setup</h2>
          <p>Configure pricing, discounts, special days, credit notes and users</p>
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
              {t.label}
            </div>
          ))}
        </div>

        <div>
          {tab === "rooms" && <RoomMasterTab />}
          {tab === "venues" && <VenueMasterTab />}
          {tab === "meal" && <MealPackageTab />}
          {tab === "discount" && <DiscountTab />}
          {tab === "special" && <SpecialDaysTab />}
          {tab === "credit" && <CreditNoteTab />}
          {tab === "users" && <UsersTab />}
        </div>
      </div>
    </div>
  );
}

// ─────────── Room Master (Pricing + Inventory) ───────────
function RoomMasterTab() {
  return (
    <>
      <RoomPricingSection />
      <div style={{ height: 18 }} />
      <RoomInventorySection />
    </>
  );
}

// ─────────── Venue Master (B2B placeholder — names only, pricing in Phase 2) ───────────
function VenueMasterTab() {
  const { venues, addVenue, updateVenue, removeVenue, showNotif } = useApp();

  const [addOpen, setAddOpen] = useState<VenueType | null>(null);
  const [newName, setNewName] = useState("");
  const [newCap, setNewCap] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    capacity: string;
    notes: string;
  } | null>(null);

  const grouped = useMemo(() => {
    return VENUE_TYPES.map((type) => ({
      type,
      items: venues.filter((v) => v.type === type),
    }));
  }, [venues]);

  const resetAddForm = () => {
    setNewName("");
    setNewCap("");
    setNewNotes("");
  };

  const onAdd = (type: VenueType) => {
    const name = newName.trim();
    if (!name) {
      showNotif("Enter a name", "error");
      return;
    }
    if (
      venues.some(
        (v) => v.type === type && v.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      showNotif(`${name} already exists under ${type}`, "error");
      return;
    }
    const cap = parseInt(newCap);
    addVenue({
      id: uid(),
      name,
      type,
      capacity: !isNaN(cap) && cap > 0 ? cap : undefined,
      notes: newNotes.trim() || undefined,
      active: true,
    });
    showNotif(`${name} added`, "success");
    setAddOpen(null);
    resetAddForm();
  };

  const onSaveEdit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      showNotif("Name is required", "error");
      return;
    }
    const cap = parseInt(editing.capacity);
    updateVenue(editing.id, {
      name,
      capacity: !isNaN(cap) && cap > 0 ? cap : undefined,
      notes: editing.notes.trim() || undefined,
    });
    showNotif("Venue updated", "success");
    setEditing(null);
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Venue Master</h3>
        <span style={{ fontSize: 12, color: "var(--t3)" }}>
          {venues.length} venue{venues.length === 1 ? "" : "s"} across{" "}
          {VENUE_TYPES.length} categories
        </span>
      </div>
      <div className="sp-body">
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
          Catalog of non-room spaces available for B2B bookings. Pricing will
          be added in Phase 2 — for now, list all conference rooms, seminar
          rooms, garden venues and event places at the resort.
        </p>

        {grouped.map(({ type, items }) => (
          <div key={type} style={{ marginBottom: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-outfit), Outfit, sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--t1)",
                  textTransform: "uppercase",
                  letterSpacing: ".4px",
                }}
              >
                {type}
              </div>
              <span
                className="badge"
                style={{ background: "var(--surf3)", color: "var(--t2)" }}
              >
                {items.length}
              </span>
              <button
                className="btn btn-ghost btn-xs"
                style={{ marginLeft: "auto" }}
                onClick={() => {
                  if (addOpen === type) {
                    setAddOpen(null);
                    resetAddForm();
                  } else {
                    setAddOpen(type);
                    resetAddForm();
                  }
                }}
              >
                {addOpen === type ? "Close" : "Add"}
              </button>
            </div>

            {addOpen === type && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 100px 1.4fr auto auto",
                  gap: 8,
                  alignItems: "end",
                  padding: 10,
                  background: "var(--surf2)",
                  border: "1px solid var(--bd)",
                  borderRadius: "var(--r2)",
                  marginBottom: 8,
                }}
              >
                <div className="field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={`e.g. ${type} 1`}
                  />
                </div>
                <div className="field">
                  <label>Capacity</label>
                  <input
                    type="number"
                    value={newCap}
                    onChange={(e) => setNewCap(e.target.value)}
                    min={0}
                    placeholder="pax"
                  />
                </div>
                <div className="field">
                  <label>Notes (optional)</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Location, equipment, etc."
                  />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onAdd(type)}
                >
                  Add
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setAddOpen(null);
                    resetAddForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {items.length === 0 ? (
              <div
                style={{
                  padding: "12px 14px",
                  border: "1px dashed var(--bd)",
                  borderRadius: "var(--r2)",
                  fontSize: 12,
                  color: "var(--t3)",
                }}
              >
                No {type.toLowerCase()}s added yet.
              </div>
            ) : (
              <table className="pricing-tbl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ width: 110, textAlign: "right" }}>Capacity</th>
                    <th>Notes</th>
                    <th style={{ width: 180, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((v) => {
                    const isEdit = editing?.id === v.id;
                    return (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 500 }}>
                          {isEdit ? (
                            <input
                              type="text"
                              value={editing!.name}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, name: e.target.value } : prev
                                )
                              }
                              autoFocus
                            />
                          ) : (
                            v.name
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {isEdit ? (
                            <input
                              type="number"
                              value={editing!.capacity}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev
                                    ? { ...prev, capacity: e.target.value }
                                    : prev
                                )
                              }
                              min={0}
                            />
                          ) : v.capacity ? (
                            `${v.capacity} pax`
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--t3)" }}>
                          {isEdit ? (
                            <input
                              type="text"
                              value={editing!.notes}
                              onChange={(e) =>
                                setEditing((prev) =>
                                  prev ? { ...prev, notes: e.target.value } : prev
                                )
                              }
                            />
                          ) : (
                            v.notes || "—"
                          )}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {isEdit ? (
                            <>
                              <button
                                className="btn btn-primary btn-xs"
                                style={{ marginRight: 6 }}
                                onClick={onSaveEdit}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setEditing(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ marginRight: 6 }}
                                onClick={() =>
                                  setEditing({
                                    id: v.id,
                                    name: v.name,
                                    capacity: v.capacity
                                      ? String(v.capacity)
                                      : "",
                                    notes: v.notes || "",
                                  })
                                }
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: "var(--red)" }}
                                onClick={() => {
                                  removeVenue(v.id);
                                  showNotif(`Removed ${v.name}`, "success");
                                }}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── Meal Package ───────────
function MealPackageTab() {
  const { packageRates, updatePackageRates, showNotif } = useApp();
  const [draft, setDraft] = useState<PackageRates>(packageRates);

  useEffect(() => setDraft(packageRates), [packageRates]);

  const save = () => {
    updatePackageRates(draft);
    showNotif("Meal package saved", "success");
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Meal Package</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setDraft(SEED_PACKAGE_RATES)}
          >
            Reset to defaults
          </button>
          <button className="btn btn-primary btn-sm" onClick={save}>
            Save Changes
          </button>
        </div>
      </div>
      <div className="sp-body">
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
          Meal &amp; Activity Package is applied per adult per night when the
          booking form's meal toggle is on. Pet Package auto-applies per pet
          per night when the guest brings pets.
        </p>
        <table className="pricing-tbl">
          <thead>
            <tr>
              <th>Package</th>
              <th>Rate (₹)</th>
              <th>Per</th>
              <th>GST</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 500 }}>Meal &amp; Activity Package</td>
              <td>
                <input
                  type="number"
                  value={draft.mealPerAdultPerNight}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      mealPerAdultPerNight: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </td>
              <td>adult / night</td>
              <td>18%</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 500 }}>Pet Package</td>
              <td>
                <input
                  type="number"
                  value={draft.petPerPetPerNight}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      petPerPetPerNight: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </td>
              <td>pet / night</td>
              <td>18%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────── Room Pricing (section inside Room Master) ───────────
function RoomPricingSection() {
  const { rooms, updateRooms, showNotif } = useApp();
  const [draftRooms, setDraftRooms] = useState<RoomMaster[]>(rooms);

  useEffect(() => setDraftRooms(rooms), [rooms]);

  const setRoomField = (id: string, key: keyof RoomMaster, value: number) => {
    setDraftRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r))
    );
  };

  const save = () => {
    updateRooms(draftRooms);
    showNotif("Room pricing saved", "success");
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Room Pricing</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setDraftRooms(SEED_ROOMS)}
          >
            Reset to defaults
          </button>
          <button className="btn btn-primary btn-sm" onClick={save}>
            Save Changes
          </button>
        </div>
      </div>
      <div className="sp-body">
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
          One fixed tariff per room. Weekday and weekend discounts auto-apply
          on the booking form based on day of stay (Fri &amp; Sat are weekend).
        </p>
        <table className="pricing-tbl">
          <thead>
            <tr>
              <th>Room Type</th>
              <th>Tariff (₹)</th>
              <th>Weekday Disc %</th>
              <th>Weekend Disc %</th>
              <th>GST %</th>
            </tr>
          </thead>
          <tbody>
            {draftRooms.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td>
                  <input
                    type="number"
                    value={r.price}
                    min={0}
                    onChange={(e) =>
                      setRoomField(r.id, "price", parseInt(e.target.value) || 0)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.weekdayDiscount}
                    min={0}
                    max={100}
                    onChange={(e) =>
                      setRoomField(
                        r.id,
                        "weekdayDiscount",
                        parseInt(e.target.value) || 0
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.weekendDiscount}
                    min={0}
                    max={100}
                    onChange={(e) =>
                      setRoomField(
                        r.id,
                        "weekendDiscount",
                        parseInt(e.target.value) || 0
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.gst}
                    min={0}
                    max={28}
                    onChange={(e) =>
                      setRoomField(r.id, "gst", parseInt(e.target.value) || 0)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────── Room Inventory (section inside Room Master) ───────────
function RoomInventorySection() {
  const {
    rooms,
    roomInventory,
    addRoomInventoryItem,
    updateRoomInventoryItem,
    bookings,
    showNotif,
  } = useApp();

  const [editingLabel, setEditingLabel] = useState<{ id: string; value: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<RoomInventoryItem | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [addOpen, setAddOpen] = useState<string | null>(null); // cat id when open
  const [addLabel, setAddLabel] = useState("");

  // Group inventory by category, preserve master ROOMS order.
  const grouped = useMemo(() => {
    return rooms.map((cat) => {
      const items = roomInventory.filter((r) => r.cat === cat.id);
      const active = items.filter((r) => r.active).length;
      return { cat, items, active, total: items.length };
    });
  }, [rooms, roomInventory]);

  const isRoomInUse = (roomId: string): number => {
    return bookings.filter(
      (b) =>
        b.allocatedRooms.includes(roomId) &&
        (b.status === "Tentative" || b.status === "Confirmed")
    ).length;
  };

  const nextLabelFor = (catId: string): string => {
    const items = roomInventory.filter((r) => r.cat === catId);
    const nums = items
      .map((r) => {
        const m = r.label.match(/(\d+)$/);
        return m ? parseInt(m[1]) : 0;
      })
      .filter((n) => !isNaN(n));
    const maxN = nums.length ? Math.max(...nums) : 0;
    const sample = items[0]?.label || "";
    const prefix = sample.replace(/\d+$/, "") || catId;
    return `${prefix}${maxN + 1}`;
  };

  const onAdd = (catId: string) => {
    const label = addLabel.trim() || nextLabelFor(catId);
    if (roomInventory.some((r) => r.id === label)) {
      showNotif(`A room with ID ${label} already exists`, "error");
      return;
    }
    const room = rooms.find((r) => r.id === catId);
    addRoomInventoryItem({
      id: label,
      label,
      type: room?.name || catId,
      cat: catId,
      active: true,
    });
    showNotif(`${label} added`, "success");
    setAddOpen(null);
    setAddLabel("");
  };

  const onConfirmBlock = () => {
    if (!blockTarget) return;
    const usedBy = isRoomInUse(blockTarget.id);
    if (usedBy > 0) {
      showNotif(
        `${blockTarget.label} is allocated to ${usedBy} active booking${
          usedBy > 1 ? "s" : ""
        } — reassign or cancel first`,
        "error"
      );
      return;
    }
    updateRoomInventoryItem(blockTarget.id, {
      active: false,
      blockedReason: blockReason.trim() || undefined,
    });
    showNotif(`${blockTarget.label} blocked`, "success");
    setBlockTarget(null);
    setBlockReason("");
  };

  const onUnblock = (room: RoomInventoryItem) => {
    updateRoomInventoryItem(room.id, { active: true, blockedReason: undefined });
    showNotif(`${room.label} unblocked`, "success");
  };

  const onLabelSave = () => {
    if (!editingLabel) return;
    const newLabel = editingLabel.value.trim();
    if (!newLabel) {
      setEditingLabel(null);
      return;
    }
    if (
      newLabel !== editingLabel.id &&
      roomInventory.some((r) => r.id === newLabel)
    ) {
      showNotif(`A room with ID ${newLabel} already exists`, "error");
      return;
    }
    // Renaming changes the id too — be cautious if bookings reference this room.
    const inUse = isRoomInUse(editingLabel.id);
    if (newLabel !== editingLabel.id && inUse > 0) {
      showNotif(
        `${editingLabel.id} is allocated to ${inUse} active booking${
          inUse > 1 ? "s" : ""
        } — can't rename`,
        "error"
      );
      return;
    }
    updateRoomInventoryItem(editingLabel.id, { id: newLabel, label: newLabel });
    setEditingLabel(null);
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Room Inventory</h3>
        <span style={{ fontSize: 12, color: "var(--t3)" }}>
          {roomInventory.filter((r) => r.active).length} active · {roomInventory.length} total
        </span>
      </div>
      <div className="sp-body">
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
          Edit physical room labels, add new rooms when commissioned, or block a room for
          renovation. Blocked rooms are skipped by the auto-allocator and shaded out in the
          Room Chart.
        </p>

        {grouped.map(({ cat, items, active, total }) => (
          <div key={cat.id} style={{ marginBottom: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-outfit), Outfit, sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--t1)",
                  textTransform: "uppercase",
                  letterSpacing: ".4px",
                }}
              >
                {cat.name}
              </div>
              <span
                className="badge"
                style={{ background: "var(--surf3)", color: "var(--t2)" }}
              >
                {active} active{active !== total ? ` / ${total} total` : ""}
              </span>
              <button
                className="btn btn-ghost btn-xs"
                style={{ marginLeft: "auto" }}
                onClick={() => {
                  setAddOpen(addOpen === cat.id ? null : cat.id);
                  setAddLabel(nextLabelFor(cat.id));
                }}
              >
                {addOpen === cat.id ? "Close" : "Add Room"}
              </button>
            </div>

            {addOpen === cat.id && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 8,
                  alignItems: "end",
                  padding: 10,
                  background: "var(--surf2)",
                  border: "1px solid var(--bd)",
                  borderRadius: "var(--r2)",
                  marginBottom: 8,
                }}
              >
                <div className="field">
                  <label>Room #</label>
                  <input
                    type="text"
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    placeholder={`e.g. ${nextLabelFor(cat.id)}`}
                  />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => onAdd(cat.id)}>
                  Add
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setAddOpen(null);
                    setAddLabel("");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {items.length === 0 ? (
              <div
                style={{
                  padding: "12px 14px",
                  border: "1px dashed var(--bd)",
                  borderRadius: "var(--r2)",
                  fontSize: 12,
                  color: "var(--t3)",
                }}
              >
                No physical rooms yet under this category.
              </div>
            ) : (
              <table className="pricing-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Room #</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th>Reason</th>
                    <th style={{ width: 180, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const isEditing = editingLabel?.id === r.id;
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500 }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingLabel!.value}
                              onChange={(e) =>
                                setEditingLabel({ id: editingLabel!.id, value: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") onLabelSave();
                                if (e.key === "Escape") setEditingLabel(null);
                              }}
                              autoFocus
                              style={{ width: 110 }}
                            />
                          ) : (
                            r.label
                          )}
                        </td>
                        <td>
                          {r.active ? (
                            <span
                              className="badge"
                              style={{ background: "var(--grn-bg)", color: "var(--grn)" }}
                            >
                              Active
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{ background: "var(--amb-bg)", color: "var(--amb)" }}
                            >
                              Blocked
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--t3)" }}>
                          {r.active ? "—" : r.blockedReason || "—"}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <>
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={onLabelSave}
                                style={{ marginRight: 6 }}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setEditingLabel(null)}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ marginRight: 6 }}
                                onClick={() =>
                                  setEditingLabel({ id: r.id, value: r.label })
                                }
                              >
                                Rename
                              </button>
                              {r.active ? (
                                <button
                                  className="btn btn-ghost btn-xs"
                                  style={{ color: "var(--amb)" }}
                                  onClick={() => {
                                    setBlockTarget(r);
                                    setBlockReason(r.blockedReason || "");
                                  }}
                                >
                                  Block
                                </button>
                              ) : (
                                <button
                                  className="btn btn-ghost btn-xs"
                                  style={{ color: "var(--grn)" }}
                                  onClick={() => onUnblock(r)}
                                >
                                  Unblock
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      {blockTarget && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBlockTarget(null);
          }}
        >
          <div className="modal modal-sm">
            <h3>Block {blockTarget.label}</h3>
            <p className="modal-desc">
              Blocked rooms are skipped by the auto-allocator and shaded out on the chart.
              Unblock from this same screen when work is done.
            </p>
            <div className="field">
              <label>Reason (optional)</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Renovation — bathroom retile"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setBlockTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={onConfirmBlock}>
                Block Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── Discount Rules ───────────
function DiscountTab() {
  const { discountCaps, updateDiscountCaps, showNotif } = useApp();
  const [draft, setDraft] = useState<DiscountCaps>(discountCaps);

  useEffect(() => setDraft(discountCaps), [discountCaps]);

  const save = () => {
    updateDiscountCaps(draft);
    showNotif("Discount rules saved", "success");
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Discount Rules by Role</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setDraft(SEED_DISCOUNT_CAPS)}
          >
            Reset to defaults
          </button>
          <button className="btn btn-primary btn-sm" onClick={save}>
            Save Changes
          </button>
        </div>
      </div>
      <div className="sp-body">
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 18 }}>
          Employees cannot exceed their ceiling. System enforces this on the booking form.
        </p>
        <div className="disc-role-row">
          <div>
            <div className="disc-role-name">Sales REX</div>
            <div className="disc-role-sub">
              Front-line sales. Fri–Sat rows always cap at 15% regardless.
            </div>
          </div>
          <div className="disc-inp">
            <input
              type="number"
              value={draft.salesRex}
              min={0}
              max={100}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, salesRex: parseInt(e.target.value) || 0 }))
              }
            />{" "}
            %
          </div>
        </div>
        <div className="disc-role-row">
          <div>
            <div className="disc-role-name">Manager</div>
            <div className="disc-role-sub">Property operations manager</div>
          </div>
          <div className="disc-inp">
            <input
              type="number"
              value={draft.manager}
              min={0}
              max={100}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, manager: parseInt(e.target.value) || 0 }))
              }
            />{" "}
            %
          </div>
        </div>
        <div className="disc-role-row" style={{ borderBottom: "none" }}>
          <div>
            <div className="disc-role-name">Admin / Owner</div>
            <div className="disc-role-sub">No limit</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--grn)" }}>
            Unlimited
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── Special Days ───────────
function SpecialDaysTab() {
  const { specialDays, addSpecialDay, removeSpecialDay, showNotif } = useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");

  const sorted = useMemo(
    () => [...specialDays].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [specialDays]
  );

  const onAdd = () => {
    if (!newDate || !newName.trim()) {
      showNotif("Pick a date and a name", "error");
      return;
    }
    addSpecialDay({ id: uid(), date: newDate, name: newName.trim() });
    setNewDate("");
    setNewName("");
    setAddOpen(false);
    showNotif("Special day added", "success");
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Special Days</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setAddOpen((v) => !v)}
        >
          {addOpen ? "Close" : "Add Special Day"}
        </button>
      </div>
      <div className="sp-body">
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
          Used by the Cancel Booking flow to determine refund vs credit-note rules.
        </p>

        {addOpen && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr auto auto",
              gap: 10,
              alignItems: "end",
              padding: "12px",
              background: "var(--surf2)",
              border: "1px solid var(--bd)",
              borderRadius: "var(--r2)",
              marginBottom: 14,
            }}
          >
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                placeholder="e.g. Holi"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={onAdd}>
              Add
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setAddOpen(false);
                setNewDate("");
                setNewName("");
              }}
            >
              Cancel
            </button>
          </div>
        )}

        <table className="pricing-tbl">
          <thead>
            <tr>
              <th style={{ width: 200 }}>Date</th>
              <th>Name</th>
              <th style={{ width: 80, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <div className="empty-state" style={{ padding: 24 }}>
                    <p>No special days yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((sd) => (
                <tr key={sd.id}>
                  <td>{formatDate(sd.date)}</td>
                  <td style={{ fontWeight: 500 }}>{sd.name}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => {
                        removeSpecialDay(sd.id);
                        showNotif(`Removed ${sd.name}`, "success");
                      }}
                    >
                      Remove
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

function formatDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  const weekday = dt.toLocaleDateString("en-IN", { weekday: "short" });
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  return `${weekday}, ${dd}/${mm}/${yyyy}`;
}

// ─────────── Credit Note Settings ───────────
function CreditNoteTab() {
  const { creditNoteSettings, updateCreditNoteSettings, showNotif } = useApp();
  const [draft, setDraft] = useState<CreditNoteSettings>(creditNoteSettings);
  const [editingNumber, setEditingNumber] = useState(false);

  useEffect(() => setDraft(creditNoteSettings), [creditNoteSettings]);

  const preview =
    (draft.prefix || "").toUpperCase() + String(draft.nextNumber).padStart(3, "0");

  const save = () => {
    updateCreditNoteSettings({
      prefix: (draft.prefix || "").toUpperCase().slice(0, 6),
      nextNumber: Math.max(1, draft.nextNumber || 1),
    });
    setEditingNumber(false);
    showNotif("Credit note settings saved", "success");
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Credit Note Settings</h3>
        <button className="btn btn-primary btn-sm" onClick={save}>
          Save Changes
        </button>
      </div>
      <div className="sp-body">
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
          Credit Notes are auto-generated when a Confirmed booking is cancelled under a
          credit-note resolution. Numbers increment automatically; only edit on first
          setup.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 520 }}>
          <div className="field">
            <label>Prefix</label>
            <input
              type="text"
              value={draft.prefix}
              maxLength={6}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  prefix: e.target.value.toUpperCase(),
                }))
              }
            />
            <div className="field-hint">Up to 6 characters, e.g. CRV.</div>
          </div>
          <div className="field">
            <label>Next Number</label>
            <input
              type="number"
              value={draft.nextNumber}
              readOnly={!editingNumber}
              min={1}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  nextNumber: parseInt(e.target.value) || 1,
                }))
              }
              style={!editingNumber ? { background: "var(--surf3)" } : undefined}
            />
            <div className="field-hint">
              <button
                type="button"
                onClick={() => setEditingNumber((v) => !v)}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: "var(--acc)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {editingNumber ? "Lock" : "Edit starting number"}
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: "12px 16px",
            background: "var(--surf2)",
            border: "1px solid var(--bd)",
            borderRadius: "var(--r2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: ".5px" }}>
            Next credit note code
          </span>
          <span
            style={{
              fontFamily: "var(--font-outfit), Outfit, sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "var(--sb)",
            }}
          >
            {preview}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────── Users ───────────
function UsersTab() {
  const { users, addUser, updateUser, removeUser, showNotif } = useApp();
  const [editing, setEditing] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setEditing({
      id: uid(),
      name: "",
      role: "Sales REX",
      email: "",
      color: colorFor("New User"),
      active: true,
    });
    setIsNew(true);
  };

  const openEdit = (u: User) => {
    setEditing({ ...u });
    setIsNew(false);
  };

  const close = () => {
    setEditing(null);
    setIsNew(false);
  };

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      showNotif("Name is required", "error");
      return;
    }
    const next: User = {
      ...editing,
      name: editing.name.trim(),
      email: editing.email.trim(),
      color: editing.color || colorFor(editing.name),
    };
    if (isNew) addUser(next);
    else updateUser(next.id, next);
    showNotif(isNew ? `${next.name} added` : "User updated", "success");
    close();
  };

  const remove = (u: User) => {
    removeUser(u.id);
    showNotif(`${u.name} removed`, "success");
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>User Management</h3>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          Add User
        </button>
      </div>
      <div className="sp-body">
        {users.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <p>No users yet</p>
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="user-item">
              <div className="user-av" style={{ background: u.color }}>
                {u.name[0] || "?"}
              </div>
              <div style={{ flex: 1 }}>
                <div className="user-name">{u.name}</div>
                <div className="user-email">{u.email || "—"}</div>
              </div>
              <div className="user-role-tag">{u.role}</div>
              <button className="btn btn-ghost btn-xs" onClick={() => openEdit(u)}>
                Edit
              </button>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => remove(u)}
                style={{ color: "var(--red)" }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {editing && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="modal modal-sm">
            <h3>{isNew ? "Add User" : `Edit ${editing.name || "User"}`}</h3>
            <div className="fg" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Name *</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, name: e.target.value, color: colorFor(e.target.value) } : prev
                    )
                  }
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  value={editing.role}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev ? { ...prev, role: e.target.value as Role } : prev
                    )
                  }
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Email</label>
                <input
                  type="email"
                  value={editing.email}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                  }
                  placeholder="user@vamaretreats.com"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save}>
                {isNew ? "Add User" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
