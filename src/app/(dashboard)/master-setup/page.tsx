"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { compareRoomLabels } from "@/lib/utils";
import type {
  AddOnCategory,
  CancellationPolicy,
  CancellationPolicyCell,
  ChargeHead,
  CreditNoteSettings,
  DiscountCaps,
  GstSettings,
  MealCustomRow,
  PackageRates,
  RoomInventoryItem,
  RoomMaster,
  SpecialDay,
  User,
  Venue,
  VenueType,
} from "@/types";

type Tab =
  | "rooms-pricing"
  | "rooms-inventory"
  | "venues"
  | "meal"
  | "addons"
  | "special"
  | "cancellation"
  | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "rooms-pricing", label: "Room Pricing" },
  { id: "rooms-inventory", label: "Room Inventory" },
  { id: "venues", label: "Venue & Services" },
  { id: "meal", label: "Meal Setup" },
  { id: "addons", label: "Add-on Charges" },
  { id: "special", label: "Special Days" },
  { id: "cancellation", label: "Cancellation Setup" },
  { id: "users", label: "Users" },
];

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
  const { currentRole } = useApp();
  const [tab, setTab] = useState<Tab>("rooms-pricing");

  if (currentRole !== "Admin") {
    return (
      <div className="view">
        <div className="pg-hd"><div><h2>Access Denied</h2><p>Master Setup is only available to Admins.</p></div></div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Master Setup</h2>
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
          {tab === "rooms-pricing" && <RoomPricingSection />}
          {tab === "rooms-inventory" && <RoomInventorySection />}
          {tab === "venues" && <VenueMasterTab />}
          {tab === "meal" && <MealSetupTab />}
          {tab === "addons" && <AddOnChargesTab />}
          {tab === "special" && <SpecialDaysTab />}
          {tab === "cancellation" && <CancellationSetupTab />}
          {tab === "users" && <UsersTab />}
        </div>
      </div>
    </div>
  );
}

// ─────────── Venue Master (B2B placeholder — names only, pricing in Phase 2) ───────────
function VenueMasterTab() {
  const { venues, venueTypes, updateVenueTypes, addVenue, updateVenue, removeVenue, showNotif } = useApp();

  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const grouped = useMemo(() => {
    // Include any type still referenced by a venue so venues never disappear
    // from the UI even if their category was removed from the list.
    const allTypes = [...venueTypes];
    venues.forEach((v) => {
      if (!allTypes.includes(v.type)) allTypes.push(v.type);
    });
    return allTypes.map((type) => ({
      type,
      items: venues.filter((v) => v.type === type),
    }));
  }, [venues, venueTypes]);

  const resetAddForm = () => {
    setNewName("");
  };

  const onAdd = (type: string) => {
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
    addVenue({
      id: uid(),
      name,
      type: type as VenueType,
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
    updateVenue(editing.id, { name });
    showNotif("Venue updated", "success");
    setEditing(null);
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Venue &amp; Services</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setAddCatOpen((v) => !v); setNewCatName(""); }}
          >
            {addCatOpen ? "Close" : "Add Category"}
          </button>
        </div>
      </div>
      <div className="sp-body">

        {addCatOpen && (
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
              marginBottom: 14,
            }}
          >
            <div className="field">
              <label>Category Name</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Rooftop Venue"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const name = newCatName.trim();
                    if (!name) { showNotif("Enter a category name", "error"); return; }
                    if (venueTypes.includes(name)) { showNotif(`${name} already exists`, "error"); return; }
                    updateVenueTypes([...venueTypes, name]);
                    showNotif(`${name} added`, "success");
                    setNewCatName("");
                    setAddCatOpen(false);
                  }
                  if (e.key === "Escape") setAddCatOpen(false);
                }}
                autoFocus
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const name = newCatName.trim();
                if (!name) { showNotif("Enter a category name", "error"); return; }
                if (venueTypes.includes(name)) { showNotif(`${name} already exists`, "error"); return; }
                updateVenueTypes([...venueTypes, name]);
                showNotif(`${name} added`, "success");
                setNewCatName("");
                setAddCatOpen(false);
              }}
            >
              Add
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAddCatOpen(false); setNewCatName(""); }}>Cancel</button>
          </div>
        )}

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
              {items.length === 0 && (
                <button
                  className="btn btn-ghost btn-xs"
                  style={{ color: "var(--red)" }}
                  onClick={() => {
                    updateVenueTypes(venueTypes.filter((t) => t !== type));
                    showNotif("Category removed", "success");
                  }}
                >
                  Remove Category
                </button>
              )}
              <button
                className="btn btn-ghost btn-xs"
                style={{ marginLeft: items.length === 0 ? 0 : "auto" }}
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
                  <label>Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={`e.g. ${type} 1`}
                    onKeyDown={(e) => { if (e.key === "Enter") onAdd(type); }}
                    autoFocus
                  />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => onAdd(type)}>Add</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setAddOpen(null); resetAddForm(); }}>Cancel</button>
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
                                onClick={() => setEditing({ id: v.id, name: v.name })}
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

// ─────────── Meal Setup (categories -> packages, persisted in settings) ───────────
function MealSetupTab() {
  const { mealCategories, updateMealCategories, showNotif } = useApp();

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [renamingCat, setRenamingCat] = useState<{ id: string; value: string } | null>(null);
  const [addPkgFor, setAddPkgFor] = useState<string | null>(null);
  const [pkgDraft, setPkgDraft] = useState({ name: "", rate: "" });
  const [editingPkg, setEditingPkg] = useState<{ catId: string; pkgId: string; name: string; rate: string } | null>(null);

  const onAddCategory = () => {
    const name = newCatName.trim();
    if (!name) { showNotif("Enter a category name", "error"); return; }
    if (mealCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      showNotif(`${name} already exists`, "error"); return;
    }
    updateMealCategories([...mealCategories, { id: uid(), name, packages: [] }]);
    setNewCatName("");
    setAddCatOpen(false);
    showNotif(`${name} added`, "success");
  };

  const onRenameCategory = () => {
    if (!renamingCat) return;
    const name = renamingCat.value.trim();
    if (!name) { showNotif("Enter a category name", "error"); return; }
    updateMealCategories(mealCategories.map((c) => (c.id === renamingCat.id ? { ...c, name } : c)));
    setRenamingCat(null);
    showNotif("Category renamed", "success");
  };

  const onRemoveCategory = (catId: string) => {
    updateMealCategories(mealCategories.filter((c) => c.id !== catId));
    showNotif("Category removed", "success");
  };

  const onAddPackage = (catId: string) => {
    const name = pkgDraft.name.trim();
    const rate = parseFloat(pkgDraft.rate) || 0;
    if (!name) { showNotif("Enter a package name", "error"); return; }
    if (rate <= 0) { showNotif("Enter a valid rate", "error"); return; }
    const cat = mealCategories.find((c) => c.id === catId);
    if (cat?.packages.some((pk) => pk.name.toLowerCase() === name.toLowerCase())) {
      showNotif(`${name} already exists under ${cat.name}`, "error"); return;
    }
    updateMealCategories(mealCategories.map((c) =>
      c.id === catId ? { ...c, packages: [...c.packages, { id: uid(), name, rate }] } : c
    ));
    setPkgDraft({ name: "", rate: "" });
    setAddPkgFor(null);
    showNotif(`${name} added`, "success");
  };

  const onSavePkgEdit = () => {
    if (!editingPkg) return;
    const name = editingPkg.name.trim();
    const rate = parseFloat(editingPkg.rate) || 0;
    if (!name) { showNotif("Enter a package name", "error"); return; }
    if (rate <= 0) { showNotif("Enter a valid rate", "error"); return; }
    updateMealCategories(mealCategories.map((c) =>
      c.id === editingPkg.catId
        ? { ...c, packages: c.packages.map((pk) => (pk.id === editingPkg.pkgId ? { ...pk, name, rate } : pk)) }
        : c
    ));
    setEditingPkg(null);
    showNotif("Package updated", "success");
  };

  const onRemovePackage = (catId: string, pkgId: string) => {
    updateMealCategories(mealCategories.map((c) =>
      c.id === catId ? { ...c, packages: c.packages.filter((pk) => pk.id !== pkgId) } : c
    ));
    showNotif("Package removed", "success");
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Meal Setup</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>
            {mealCategories.reduce((s, c) => s + c.packages.length, 0)} packages across {mealCategories.length} categories
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setAddCatOpen((v) => !v); setNewCatName(""); }}>
            {addCatOpen ? "Close" : "Add Category"}
          </button>
        </div>
      </div>
      <div className="sp-body">
        {addCatOpen && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "end", padding: 10, background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r2)", marginBottom: 14 }}>
            <div className="field">
              <label>Category Name</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Festive Packages"
                onKeyDown={(e) => { if (e.key === "Enter") onAddCategory(); if (e.key === "Escape") setAddCatOpen(false); }}
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={onAddCategory}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddCatOpen(false)}>Cancel</button>
          </div>
        )}

        {mealCategories.map((cat) => (
          <div key={cat.id} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {renamingCat?.id === cat.id ? (
                <>
                  <input
                    type="text"
                    value={renamingCat.value}
                    onChange={(e) => setRenamingCat({ id: cat.id, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") onRenameCategory(); if (e.key === "Escape") setRenamingCat(null); }}
                    autoFocus
                    style={{ fontWeight: 700, fontSize: 13, width: 220 }}
                  />
                  <button className="btn btn-primary btn-xs" onClick={onRenameCategory}>Save</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setRenamingCat(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--t1)", textTransform: "uppercase", letterSpacing: ".4px" }}>
                    {cat.name}
                  </div>
                  <span className="badge" style={{ background: "var(--surf3)", color: "var(--t2)" }}>
                    {cat.packages.length}
                  </span>
                  <button className="btn btn-ghost btn-xs" onClick={() => setRenamingCat({ id: cat.id, value: cat.name })}>
                    Rename
                  </button>
                  {cat.packages.length === 0 && (
                    <button
                      className="btn btn-ghost btn-xs"
                      style={{ color: "var(--red)" }}
                      onClick={() => onRemoveCategory(cat.id)}
                    >
                      Remove Category
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-xs"
                    style={{ marginLeft: "auto" }}
                    onClick={() => {
                      setAddPkgFor(addPkgFor === cat.id ? null : cat.id);
                      setPkgDraft({ name: "", rate: "" });
                    }}
                  >
                    {addPkgFor === cat.id ? "Close" : "Add"}
                  </button>
                </>
              )}
            </div>

            {addPkgFor === cat.id && (
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 130px auto auto", gap: 8, alignItems: "end", padding: 10, background: "var(--surf2)", border: "1px solid var(--bd)", borderRadius: "var(--r2)", marginBottom: 8 }}>
                <div className="field">
                  <label>Package Name</label>
                  <input
                    type="text"
                    value={pkgDraft.name}
                    onChange={(e) => setPkgDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Kids Package"
                    onKeyDown={(e) => { if (e.key === "Enter") onAddPackage(cat.id); if (e.key === "Escape") setAddPkgFor(null); }}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Rate (₹)</label>
                  <input type="number" value={pkgDraft.rate} min={0} onChange={(e) => setPkgDraft((d) => ({ ...d, rate: e.target.value }))} placeholder="0" />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => onAddPackage(cat.id)}>Add</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddPkgFor(null)}>Cancel</button>
              </div>
            )}

            {cat.packages.length === 0 ? (
              <div style={{ padding: "14px 12px", border: "1px dashed var(--bd)", borderRadius: "var(--r2)", fontSize: 12, color: "var(--t3)" }}>
                No packages added yet.
              </div>
            ) : (
              <table className="pricing-tbl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ width: 160, textAlign: "right" }}>Rate (₹)</th>
                    <th style={{ width: 160, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.packages.map((pk) => (
                    <tr key={pk.id}>
                      {editingPkg?.catId === cat.id && editingPkg?.pkgId === pk.id ? (
                        <>
                          <td>
                            <input
                              type="text"
                              value={editingPkg.name}
                              onChange={(e) => setEditingPkg({ ...editingPkg, name: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") onSavePkgEdit(); if (e.key === "Escape") setEditingPkg(null); }}
                              autoFocus
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={editingPkg.rate}
                              min={0}
                              style={{ textAlign: "right" }}
                              onChange={(e) => setEditingPkg({ ...editingPkg, rate: e.target.value })}
                            />
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button className="btn btn-primary btn-xs" onClick={onSavePkgEdit} style={{ marginRight: 6 }}>Save</button>
                            <button className="btn btn-ghost btn-xs" onClick={() => setEditingPkg(null)}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ fontWeight: 500 }}>{pk.name}</td>
                          <td style={{ textAlign: "right" }}>₹{pk.rate.toLocaleString("en-IN")}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button
                              className="btn btn-ghost btn-xs"
                              onClick={() => setEditingPkg({ catId: cat.id, pkgId: pk.id, name: pk.name, rate: String(pk.rate) })}
                              style={{ marginRight: 6 }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-xs"
                              style={{ color: "var(--red)" }}
                              onClick={() => onRemovePackage(cat.id, pk.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────── Room Pricing ───────────
function RoomPricingSection() {
  const { rooms, updateRooms, gstSettings, updateGstSettings, showNotif } = useApp();
  const [draftRooms, setDraftRooms] = useState<RoomMaster[]>(rooms);
  const [draftGst, setDraftGst] = useState<GstSettings>(gstSettings);

  useEffect(() => setDraftRooms(rooms), [rooms]);
  useEffect(() => setDraftGst(gstSettings), [gstSettings]);

  const setRoomField = (id: string, key: keyof RoomMaster, value: number) => {
    setDraftRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r))
    );
  };

  const save = () => {
    updateRooms(draftRooms);
    updateGstSettings(draftGst);
    showNotif("Room pricing saved", "success");
  };


  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Room Pricing</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={save}>
            Save Changes
          </button>
        </div>
      </div>
      <div className="sp-body">
        <table className="pricing-tbl">
          <thead>
            <tr>
              <th>Room Type</th>
              <th style={{ textAlign: "right", width: 120 }}>Tariff (₹)</th>
              <th style={{ textAlign: "right", width: 120 }}>Sun–Thu Disc %</th>
              <th style={{ textAlign: "right", width: 120 }}>Friday Disc %</th>
              <th style={{ textAlign: "right", width: 120 }}>Sat Disc %</th>
              <th style={{ textAlign: "right", width: 140 }}>Special Days Disc %</th>
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
                      setRoomField(r.id, "weekdayDiscount", parseInt(e.target.value) || 0)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.fridayDiscount ?? 15}
                    min={0}
                    max={100}
                    onChange={(e) =>
                      setRoomField(r.id, "fridayDiscount", parseInt(e.target.value) || 0)
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
                      setRoomField(r.id, "weekendDiscount", parseInt(e.target.value) || 0)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.specialDayDiscount ?? 0}
                    min={0}
                    max={100}
                    onChange={(e) =>
                      setRoomField(r.id, "specialDayDiscount", parseInt(e.target.value) || 0)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--bd)" }}>
          <div style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>
            GST Rate
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, maxWidth: 520 }}>
            <div className="field">
              <label>Threshold (₹)</label>
              <input
                type="number"
                value={draftGst.threshold}
                min={0}
                onChange={(e) =>
                  setDraftGst((prev) => ({ ...prev, threshold: parseInt(e.target.value) || 0 }))
                }
              />
            </div>
            <div className="field">
              <label>GST if net rate ≤ threshold</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  value={draftGst.belowRate}
                  min={0}
                  max={28}
                  onChange={(e) =>
                    setDraftGst((prev) => ({ ...prev, belowRate: parseInt(e.target.value) || 0 }))
                  }
                />
                <span style={{ fontSize: 13 }}>%</span>
              </div>
            </div>
            <div className="field">
              <label>GST if net rate &gt; threshold</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  value={draftGst.aboveRate}
                  min={0}
                  max={28}
                  onChange={(e) =>
                    setDraftGst((prev) => ({ ...prev, aboveRate: parseInt(e.target.value) || 0 }))
                  }
                />
                <span style={{ fontSize: 13 }}>%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────── Room Inventory (section inside Room Master) ───────────
function RoomInventorySection() {
  const {
    rooms,
    updateRooms,
    roomInventory,
    addRoomInventoryItem,
    updateRoomInventoryItem,
    removeRoomInventoryItem,
    bookings,
    showNotif,
  } = useApp();

  const [editingLabel, setEditingLabel] = useState<{ id: string; value: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoomInventoryItem | null>(null);
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [addLabel, setAddLabel] = useState("");
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [renamingCat, setRenamingCat] = useState<{ id: string; value: string } | null>(null);
  const [removeCatConfirm, setRemoveCatConfirm] = useState<string | null>(null);

  // Group inventory by category, preserve master ROOMS order; rooms within a
  // category sort by label numerically (same order as the room chart).
  const grouped = useMemo(() => {
    return rooms.map((cat) => {
      const items = roomInventory
        .filter((r) => r.cat === cat.id)
        .sort((a, b) => compareRoomLabels(a.label, b.label));
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

  const onConfirmDelete = () => {
    if (!deleteTarget) return;
    const usedBy = isRoomInUse(deleteTarget.id);
    if (usedBy > 0) {
      showNotif(
        `${deleteTarget.label} is allocated to ${usedBy} active booking${
          usedBy > 1 ? "s" : ""
        } — reassign or cancel first`,
        "error"
      );
      setDeleteTarget(null);
      return;
    }
    removeRoomInventoryItem(deleteTarget.id);
    showNotif(`${deleteTarget.label} deleted`, "success");
    setDeleteTarget(null);
  };

  const onUnblock = (room: RoomInventoryItem) => {
    updateRoomInventoryItem(room.id, { active: true, blockedReason: undefined });
    showNotif(`${room.label} unblocked`, "success");
  };

  const onAddCategory = () => {
    const name = newCatName.trim();
    if (!name) { showNotif("Enter a category name", "error"); return; }
    if (rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      showNotif(`${name} already exists`, "error");
      return;
    }
    updateRooms([
      ...rooms,
      {
        id: uid(),
        name,
        price: 0,
        weekdayDiscount: 0,
        fridayDiscount: 0,
        weekendDiscount: 0,
        specialDayDiscount: 0,
      },
    ]);
    showNotif(`${name} added`, "success");
    setNewCatName("");
    setAddCatOpen(false);
  };

  const onRemoveCategory = (catId: string) => {
    updateRooms(rooms.filter((r) => r.id !== catId));
    roomInventory
      .filter((r) => r.cat === catId)
      .forEach((r) => removeRoomInventoryItem(r.id));
    showNotif("Category removed", "success");
    setRemoveCatConfirm(null);
  };

  const onRenameCategory = () => {
    if (!renamingCat) return;
    const name = renamingCat.value.trim();
    if (!name) { showNotif("Enter a category name", "error"); return; }
    if (rooms.some((r) => r.id !== renamingCat.id && r.name.toLowerCase() === name.toLowerCase())) {
      showNotif(`${name} already exists`, "error"); return;
    }
    updateRooms(rooms.map((r) => r.id === renamingCat.id ? { ...r, name } : r));
    // Sync the type label on every inventory room in this category
    roomInventory
      .filter((r) => r.cat === renamingCat.id)
      .forEach((r) => updateRoomInventoryItem(r.id, { type: name }));
    showNotif("Category renamed", "success");
    setRenamingCat(null);
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>
            {roomInventory.filter((r) => r.active).length} active · {roomInventory.length} total
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setAddCatOpen((v) => !v); setNewCatName(""); }}
          >
            {addCatOpen ? "Close" : "Add Category"}
          </button>
        </div>
      </div>
      <div className="sp-body">

        {addCatOpen && (
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
              marginBottom: 14,
            }}
          >
            <div className="field">
              <label>Category Name</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Deluxe Suite"
                onKeyDown={(e) => { if (e.key === "Enter") onAddCategory(); if (e.key === "Escape") setAddCatOpen(false); }}
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={onAddCategory}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAddCatOpen(false); setNewCatName(""); }}>Cancel</button>
          </div>
        )}

        {grouped.map(({ cat, items, active, total }) => (
          <div key={cat.id} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {renamingCat?.id === cat.id ? (
                <>
                  <input
                    type="text"
                    value={renamingCat.value}
                    onChange={(e) => setRenamingCat({ id: cat.id, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") onRenameCategory(); if (e.key === "Escape") setRenamingCat(null); }}
                    autoFocus
                    style={{ fontWeight: 700, fontSize: 13, width: 180 }}
                  />
                  <button className="btn btn-primary btn-xs" onClick={onRenameCategory}>Save</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setRenamingCat(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: "var(--font-outfit), Outfit, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--t1)", textTransform: "uppercase", letterSpacing: ".4px" }}>
                    {cat.name}
                  </div>
                  <span className="badge" style={{ background: "var(--surf3)", color: "var(--t2)" }}>
                    {active} active{active !== total ? ` / ${total} total` : ""}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => { setRenamingCat({ id: cat.id, value: cat.name }); setAddOpen(null); }}
                  >
                    Rename
                  </button>
                  {removeCatConfirm === cat.id ? (
                    <>
                      <span style={{ fontSize: 11, color: "var(--t2)" }}>Remove all {total} room{total !== 1 ? "s" : ""} too?</span>
                      <button className="btn btn-danger btn-xs" onClick={() => onRemoveCategory(cat.id)}>Yes, Remove</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setRemoveCatConfirm(null)}>Cancel</button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-xs"
                      style={{ color: "var(--red)" }}
                      onClick={() => items.length === 0 ? onRemoveCategory(cat.id) : setRemoveCatConfirm(cat.id)}
                    >
                      Remove
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-xs"
                    style={{ marginLeft: "auto" }}
                    onClick={() => { setAddOpen(addOpen === cat.id ? null : cat.id); setAddLabel(nextLabelFor(cat.id)); }}
                  >
                    {addOpen === cat.id ? "Close" : "Add Room"}
                  </button>
                </>
              )}
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
                                  style={{ color: "var(--red)" }}
                                  onClick={() => setDeleteTarget(r)}
                                >
                                  Delete
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

      {deleteTarget && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="modal modal-sm">
            <h3>Delete {deleteTarget.label}?</h3>
            <p className="modal-desc">
              This cannot be undone. The room will be permanently removed from inventory.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={onConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────── Discount Rules ───────────
// ─────────── Special Days ───────────
// ─────────── Add-on Charges Master ───────────
// Names only — amount and GST are entered per booking. `head` decides which
// Revenue Register column the charge reports under.
const CHARGE_HEADS: { head: ChargeHead; label: string }[] = [
  { head: "room", label: "Room Charges" },
  { head: "meal", label: "Meal Charges" },
  { head: "other", label: "Other Charges" },
];

const headLabel = (h: ChargeHead) =>
  CHARGE_HEADS.find((c) => c.head === h)?.label ?? "Other Charges";

function AddOnChargesTab() {
  const { addOnCategories, updateAddOnCategories, showNotif } = useApp();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHead, setNewHead] = useState<ChargeHead>("other");
  const [editing, setEditing] = useState<AddOnCategory | null>(null);

  const isDuplicate = (name: string, exceptId?: string) =>
    addOnCategories.some(
      (c) => c.id !== exceptId && c.name.trim().toLowerCase() === name.toLowerCase()
    );

  const resetAdd = () => {
    setNewName("");
    setNewHead("other");
    setAddOpen(false);
  };

  const onAdd = () => {
    const name = newName.trim();
    if (!name) {
      showNotif("Enter an add-on name", "error");
      return;
    }
    if (isDuplicate(name)) {
      showNotif(`${name} already exists`, "error");
      return;
    }
    updateAddOnCategories([...addOnCategories, { id: uid(), name, head: newHead }]);
    showNotif(`${name} added`, "success");
    resetAdd();
  };

  const onSaveEdit = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      showNotif("Name is required", "error");
      return;
    }
    if (isDuplicate(name, editing.id)) {
      showNotif(`${name} already exists`, "error");
      return;
    }
    updateAddOnCategories(
      addOnCategories.map((c) =>
        c.id === editing.id ? { ...c, name, head: editing.head } : c
      )
    );
    showNotif("Add-on charge updated", "success");
    setEditing(null);
  };

  const onRemove = (cat: AddOnCategory) => {
    if (addOnCategories.length <= 1) {
      showNotif("Keep at least one add-on charge item", "error");
      return;
    }
    updateAddOnCategories(addOnCategories.filter((c) => c.id !== cat.id));
    if (editing?.id === cat.id) setEditing(null);
    showNotif(`Removed ${cat.name}`, "success");
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Add-on Charges</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            setEditing(null);
            setAddOpen((v) => !v);
          }}
        >
          {addOpen ? "Close" : "Add Item"}
        </button>
      </div>
      <div className="sp-body">
        <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
          Items offered in the Add-on Charges section of a booking. Amount and GST
          are entered per booking. Reports Under decides which column the charge
          appears in on the Revenue Register.
        </p>

        {addOpen && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 200px auto auto",
              gap: 10,
              alignItems: "end",
              padding: 12,
              background: "var(--surf2)",
              border: "1px solid var(--bd)",
              borderRadius: "var(--r2)",
              marginBottom: 14,
            }}
          >
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                placeholder="e.g. Spa Charges"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAdd();
                  if (e.key === "Escape") resetAdd();
                }}
                autoFocus
              />
            </div>
            <div className="field">
              <label>Reports Under</label>
              <select
                value={newHead}
                onChange={(e) => setNewHead(e.target.value as ChargeHead)}
              >
                {CHARGE_HEADS.map((c) => (
                  <option key={c.head} value={c.head}>{c.label}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={onAdd}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={resetAdd}>Cancel</button>
          </div>
        )}

        <table className="pricing-tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th style={{ width: 220 }}>Reports Under</th>
              <th style={{ width: 160, textAlign: "right" }}></th>
            </tr>
          </thead>
          <tbody>
            {addOnCategories.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <div className="empty-state" style={{ padding: 24 }}>
                    <p>No add-on charges yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              addOnCategories.map((cat) =>
                editing?.id === cat.id ? (
                  <tr key={cat.id}>
                    <td>
                      <input
                        type="text"
                        value={editing.name}
                        onChange={(e) =>
                          setEditing({ ...editing, name: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSaveEdit();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        autoFocus
                      />
                    </td>
                    <td>
                      <select
                        value={editing.head}
                        onChange={(e) =>
                          setEditing({ ...editing, head: e.target.value as ChargeHead })
                        }
                      >
                        {CHARGE_HEADS.map((c) => (
                          <option key={c.head} value={c.head}>{c.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-primary btn-xs" onClick={onSaveEdit}>
                        Save
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ marginLeft: 6 }}
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: 500 }}>{cat.name}</td>
                    <td>{headLabel(cat.head)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          setAddOpen(false);
                          setEditing({ ...cat });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        style={{ marginLeft: 6 }}
                        onClick={() => onRemove(cat)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

// ─────────── Cancellation Setup ───────────
function CancellationSetupTab() {
  return (
    <>
      <CancellationLogicSection />
      <div style={{ height: 18 }} />
      <CreditNoteSection />
    </>
  );
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

type ColKey = "standardAbove" | "standardBelow" | "specialAbove" | "specialBelow";

function CancellationLogicSection() {
  const { cancellationPolicy, updateCancellationPolicy, showNotif } = useApp();
  const [draft, setDraft] = useState<CancellationPolicy>(cancellationPolicy);

  useEffect(() => setDraft(cancellationPolicy), [cancellationPolicy]);

  const setThreshold = (field: "standardThreshold" | "specialThreshold", v: number) =>
    setDraft((prev) => ({ ...prev, [field]: v }));

  const setCell = (col: ColKey, field: keyof CancellationPolicyCell, value: number | null) =>
    setDraft((prev) => ({ ...prev, [col]: { ...prev[col], [field]: value } }));

  const setNote = (i: number, v: string) =>
    setDraft((prev) => {
      const notes = [...prev.notes];
      notes[i] = v;
      return { ...prev, notes };
    });

  const addNote = () => setDraft((prev) => ({ ...prev, notes: [...prev.notes, ""] }));

  const removeNote = (i: number) =>
    setDraft((prev) => ({ ...prev, notes: prev.notes.filter((_, idx) => idx !== i) }));

  const save = () => {
    updateCancellationPolicy(draft);
    showNotif("Cancellation policy saved", "success");
  };

  const renderCancellationCell = (col: ColKey) => (
    <td key={col} style={{ padding: "10px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          value={draft[col].cancellationChargePct}
          min={0}
          max={100}
          style={{ flex: 1, minWidth: 0, textAlign: "center" }}
          onChange={(e) =>
            setCell(col, "cancellationChargePct", parseInt(e.target.value) || 0)
          }
        />
        <span style={{ fontSize: 13, color: "var(--t2)", flexShrink: 0 }}>%</span>
      </div>
    </td>
  );

  const renderRefundCell = (col: ColKey) => {
    const v = draft[col].refundPct;
    return (
      <td key={col} style={{ padding: "10px 8px" }}>
        {v === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--t3)",
                background: "var(--surf3)",
                border: "1px solid var(--bd)",
                borderRadius: "var(--r1)",
                padding: "6px 4px",
                cursor: "default",
              }}
            >
              NA
            </span>
            <button
              className="btn btn-ghost btn-xs"
              style={{ flexShrink: 0 }}
              title="Enter a value"
              onClick={() => setCell(col, "refundPct", 100)}
            >
              Set
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              value={v}
              min={0}
              max={100}
              style={{ flex: 1, minWidth: 0, textAlign: "center" }}
              onChange={(e) =>
                setCell(col, "refundPct", parseInt(e.target.value) || 0)
              }
            />
            <span style={{ fontSize: 13, color: "var(--t2)", flexShrink: 0 }}>%</span>
            <button
              className="btn btn-ghost btn-xs"
              style={{ flexShrink: 0, color: "var(--t3)" }}
              title="Set as NA"
              onClick={() => setCell(col, "refundPct", null)}
            >
              NA
            </button>
          </div>
        )}
      </td>
    );
  };

  const renderCreditNoteCell = (col: ColKey) => {
    const v = draft[col].creditNotePct;
    return (
      <td key={col} style={{ padding: "10px 8px" }}>
        {v === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--t3)",
                background: "var(--surf3)",
                border: "1px solid var(--bd)",
                borderRadius: "var(--r1)",
                padding: "6px 4px",
                cursor: "default",
              }}
            >
              NA
            </span>
            <button
              className="btn btn-ghost btn-xs"
              style={{ flexShrink: 0 }}
              title="Enter a value"
              onClick={() => setCell(col, "creditNotePct", 100)}
            >
              Set
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              value={v}
              min={0}
              max={100}
              style={{ flex: 1, minWidth: 0, textAlign: "center" }}
              onChange={(e) =>
                setCell(col, "creditNotePct", parseInt(e.target.value) || 0)
              }
            />
            <span style={{ fontSize: 13, color: "var(--t2)", flexShrink: 0 }}>%</span>
            <button
              className="btn btn-ghost btn-xs"
              style={{ flexShrink: 0, color: "var(--t3)" }}
              title="Set as NA"
              onClick={() => setCell(col, "creditNotePct", null)}
            >
              NA
            </button>
          </div>
        )}
      </td>
    );
  };

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>Cancellation Policy</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={save}>
            Save Changes
          </button>
        </div>
      </div>
      <div className="sp-body">

        {/* Table 1: Standard Days */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 12,
          }}>
            <div style={{
              fontFamily: "var(--font-outfit), Outfit, sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--t1)",
              textTransform: "uppercase",
              letterSpacing: ".4px",
            }}>
              Standard Days
            </div>
            <div className="field" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ marginBottom: 0, whiteSpace: "nowrap", fontSize: 12 }}>Threshold:</label>
              <input
                type="number"
                value={draft.standardThreshold}
                min={1}
                style={{ width: 60 }}
                onChange={(e) => setThreshold("standardThreshold", parseInt(e.target.value) || 1)}
              />
              <span style={{ fontSize: 12, color: "var(--t3)", whiteSpace: "nowrap" }}>days before check-in</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="pricing-tbl" style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "33%" }} />
                <col style={{ width: "33%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th></th>
                  <th style={{ textAlign: "center", fontSize: 11, fontWeight: 500, color: "var(--t2)", padding: "8px 6px", lineHeight: 1.4 }}>
                    {`> ${draft.standardThreshold} days`}
                  </th>
                  <th style={{ textAlign: "center", fontSize: 11, fontWeight: 500, color: "var(--t2)", padding: "8px 6px", lineHeight: 1.4 }}>
                    {`< ${draft.standardThreshold} days`}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>Cancellation Charges</td>
                  {renderCancellationCell("standardAbove")}
                  {renderCancellationCell("standardBelow")}
                </tr>
                <tr>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>Refund</td>
                  {renderRefundCell("standardAbove")}
                  {renderRefundCell("standardBelow")}
                </tr>
                <tr>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>Credit Note</td>
                  {renderCreditNoteCell("standardAbove")}
                  {renderCreditNoteCell("standardBelow")}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid var(--bd)", marginBottom: 28 }} />

        {/* Table 2: Special Days */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 12,
          }}>
            <div style={{
              fontFamily: "var(--font-outfit), Outfit, sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--t1)",
              textTransform: "uppercase",
              letterSpacing: ".4px",
            }}>
              Special Days
            </div>
            <div className="field" style={{ marginBottom: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ marginBottom: 0, whiteSpace: "nowrap", fontSize: 12 }}>Threshold:</label>
              <input
                type="number"
                value={draft.specialThreshold}
                min={1}
                style={{ width: 60 }}
                onChange={(e) => setThreshold("specialThreshold", parseInt(e.target.value) || 1)}
              />
              <span style={{ fontSize: 12, color: "var(--t3)", whiteSpace: "nowrap" }}>days before check-in</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="pricing-tbl" style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: "34%" }} />
                <col style={{ width: "33%" }} />
                <col style={{ width: "33%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th></th>
                  <th style={{ textAlign: "center", fontSize: 11, fontWeight: 500, color: "var(--t2)", padding: "8px 6px", lineHeight: 1.4 }}>
                    {`> ${draft.specialThreshold} days`}
                  </th>
                  <th style={{ textAlign: "center", fontSize: 11, fontWeight: 500, color: "var(--t2)", padding: "8px 6px", lineHeight: 1.4 }}>
                    {`< ${draft.specialThreshold} days`}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>Cancellation Charges</td>
                  {renderCancellationCell("specialAbove")}
                  {renderCancellationCell("specialBelow")}
                </tr>
                <tr>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>Refund</td>
                  {renderRefundCell("specialAbove")}
                  {renderRefundCell("specialBelow")}
                </tr>
                <tr>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>Credit Note</td>
                  {renderCreditNoteCell("specialAbove")}
                  {renderCreditNoteCell("specialBelow")}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginTop: 4, paddingTop: 20, borderTop: "1px solid var(--bd)" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}>
            <span style={{
              fontFamily: "var(--font-outfit), Outfit, sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--t1)",
            }}>
              Notes
            </span>
            <button className="btn btn-ghost btn-xs" onClick={addNote}>
              Add Note
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draft.notes.map((note, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 12,
                  color: "var(--t3)",
                  minWidth: 24,
                  textAlign: "right",
                  flexShrink: 0,
                }}>
                  ({ROMAN[i] ?? i + 1})
                </span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(i, e.target.value)}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button
                  className="btn btn-ghost btn-xs"
                  style={{ color: "var(--red)", flexShrink: 0 }}
                  onClick={() => removeNote(i)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function CreditNoteSection() {
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
        <h3>Credit Note Setup</h3>
        <button className="btn btn-primary btn-sm" onClick={save}>
          Save Changes
        </button>
      </div>
      <div className="sp-body">

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 520 }}>
          <div className="field">
            <label>Prefix</label>
            <input
              type="text"
              value={draft.prefix}
              maxLength={6}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))
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
                setDraft((prev) => ({ ...prev, nextNumber: parseInt(e.target.value) || 1 }))
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
type ApiUser = {
  id: string;
  name: string;
  role: string;
  email: string;
  color: string;
  active: boolean;
  plainPassword?: string | null;
};

function UsersTab() {
  const { showNotif, userRoles, updateUserRoles } = useApp();
  const [apiUsers, setApiUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Role list is persisted in app settings; also show any role still
  // referenced by an existing user.
  const roles = useMemo(() => {
    const out = [...userRoles];
    apiUsers.forEach((u) => {
      if (!out.includes(u.role)) out.push(u.role);
    });
    return out;
  }, [userRoles, apiUsers]);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  // Inline add user per role
  const [addForRole, setAddForRole] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState({ name: "", password: "" });

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", password: "" });

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<ApiUser | null>(null);

  // Show/hide password per user
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const togglePasswordVisible = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setApiUsers(data);
      }
    } catch {
      showNotif("Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byRole = useMemo(() => {
    const map: Record<string, ApiUser[]> = {};
    for (const r of roles) map[r] = [];
    for (const u of apiUsers) {
      if (!map[u.role]) map[u.role] = [];
      map[u.role].push(u);
    }
    return map;
  }, [apiUsers, roles]);

  const onAddRole = () => {
    const name = newRoleName.trim();
    if (!name) { showNotif("Enter a role name", "error"); return; }
    if (roles.some((r) => r.toLowerCase() === name.toLowerCase())) {
      showNotif(`${name} already exists`, "error"); return;
    }
    updateUserRoles([...userRoles, name]);
    setNewRoleName("");
    setAddRoleOpen(false);
    showNotif(`${name} role created`, "success");
  };

  const onAddUser = async (role: string) => {
    const name = addDraft.name.trim();
    const password = addDraft.password.trim();
    if (!name) { showNotif("Name is required", "error"); return; }
    if (!password) { showNotif("Password is required", "error"); return; }
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}@vamaretreats.com`;
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, color: colorFor(name) }),
      });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || "Failed to create user", "error"); return; }
      showNotif(`${name} added`, "success");
      setAddForRole(null);
      setAddDraft({ name: "", password: "" });
      await fetchUsers();
    } catch {
      showNotif("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const onSaveEdit = async (u: ApiUser) => {
    const name = editDraft.name.trim();
    if (!name) { showNotif("Name is required", "error"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        email: u.email,
        role: u.role,
        color: colorFor(name),
        active: u.active,
        ...(editDraft.password.trim() && { password: editDraft.password.trim() }),
      };
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || "Failed to update user", "error"); return; }
      showNotif("User updated", "success");
      setEditingId(null);
      await fetchUsers();
    } catch {
      showNotif("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteConfirm) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${deleteConfirm.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { showNotif(data.error || "Failed to delete user", "error"); return; }
      showNotif(`${deleteConfirm.name} removed`, "success");
      setDeleteConfirm(null);
      await fetchUsers();
    } catch {
      showNotif("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-panel">
        <div className="sp-hd"><h3>User List</h3></div>
        <div className="sp-body">
          <div style={{ padding: 24, fontSize: 13, color: "var(--t3)" }}>Loading users…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-panel">
      <div className="sp-hd">
        <h3>User List</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setAddRoleOpen((v) => !v); setNewRoleName(""); }}
        >
          {addRoleOpen ? "Close" : "Add User Role"}
        </button>
      </div>

      {addRoleOpen && (
        <div style={{ padding: "0 0 16px 0" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: 8,
            alignItems: "end",
            padding: 12,
            background: "var(--surf2)",
            border: "1px solid var(--bd)",
            borderRadius: "var(--r2)",
          }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Role Name</label>
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Housekeeping"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") onAddRole(); if (e.key === "Escape") setAddRoleOpen(false); }}
              />
            </div>
            <button className="btn btn-primary btn-sm" onClick={onAddRole}>Add Role</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAddRoleOpen(false); setNewRoleName(""); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="sp-body">
        {roles.map((role) => {
          const users = byRole[role] ?? [];
          return (
            <div key={role} style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  fontFamily: "var(--font-outfit), Outfit, sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--t1)",
                  textTransform: "uppercase",
                  letterSpacing: ".4px",
                }}>
                  {role}
                </div>
                <span className="badge" style={{ background: "var(--surf3)", color: "var(--t2)" }}>
                  {users.length} user{users.length !== 1 ? "s" : ""}
                </span>
              </div>

              <table className="pricing-tbl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ width: 200 }}>Password</th>
                    <th style={{ width: 180, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isEditing = editingId === u.id;
                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 500 }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft.name}
                              onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                              autoFocus
                            />
                          ) : u.name}
                        </td>
                        <td>
                          {isEditing ? (
                            <input
                              type="password"
                              value={editDraft.password}
                              onChange={(e) => setEditDraft((p) => ({ ...p, password: e.target.value }))}
                              placeholder="Leave blank to keep"
                              autoComplete="new-password"
                            />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ color: "var(--t2)", fontFamily: "monospace", fontSize: 13, letterSpacing: visiblePasswords.has(u.id) ? 0 : 2 }}>
                                {visiblePasswords.has(u.id)
                                  ? (u.plainPassword || "••••••••")
                                  : "••••••••"}
                              </span>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ padding: "2px 7px", fontSize: 11 }}
                                onClick={() => togglePasswordVisible(u.id)}
                                title={visiblePasswords.has(u.id) ? "Hide password" : "Show password"}
                              >
                                {visiblePasswords.has(u.id) ? "Hide" : "Show"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {isEditing ? (
                            <>
                              <button
                                className="btn btn-primary btn-xs"
                                style={{ marginRight: 6 }}
                                onClick={() => onSaveEdit(u)}
                                disabled={saving}
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button className="btn btn-ghost btn-xs" onClick={() => setEditingId(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ marginRight: 6 }}
                                onClick={() => {
                                  setEditingId(u.id);
                                  setEditDraft({ name: u.name, password: "" });
                                  setAddForRole(null);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: "var(--red)" }}
                                onClick={() => setDeleteConfirm(u)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {addForRole === role && (
                    <tr>
                      <td>
                        <input
                          type="text"
                          value={addDraft.name}
                          onChange={(e) => setAddDraft((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Name"
                          autoFocus
                        />
                      </td>
                      <td>
                        <input
                          type="password"
                          value={addDraft.password}
                          onChange={(e) => setAddDraft((p) => ({ ...p, password: e.target.value }))}
                          placeholder="Password"
                          autoComplete="new-password"
                        />
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          className="btn btn-primary btn-xs"
                          style={{ marginRight: 6 }}
                          onClick={() => onAddUser(role)}
                          disabled={saving}
                        >
                          {saving ? "Adding…" : "Add"}
                        </button>
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => { setAddForRole(null); setAddDraft({ name: "", password: "" }); }}
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  )}

                  {users.length === 0 && addForRole !== role && (
                    <tr>
                      <td colSpan={3} style={{ color: "var(--t3)", fontSize: 12 }}>
                        No users in this role yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {addForRole !== role && (
                <button
                  className="btn btn-ghost btn-xs"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setAddForRole(role);
                    setAddDraft({ name: "", password: "" });
                    setEditingId(null);
                  }}
                >
                  + Add User
                </button>
              )}
            </div>
          );
        })}
      </div>

      {deleteConfirm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div className="modal modal-sm">
            <h3>Delete {deleteConfirm.name}?</h3>
            <p className="modal-desc">
              This user will no longer be able to log in.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-danger" onClick={onDelete} disabled={saving}>
                {saving ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
