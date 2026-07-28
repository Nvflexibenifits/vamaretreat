"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { blockOccupancyEnd, compareRoomLabels, findAvailableRoomIds, fmt, fmtIN, roomsHeldOnDate, sortRoomInventory, todayStr } from "@/lib/utils";
import type {
  Booking,
  BulkRoomBlock,
  BulkRoomBlockRow,
  RoomMaster,
  RoomNightUpgrade,
  Venue,
  VenueBlock,
  VenueType,
} from "@/types";

const DAYS_WINDOW = 30;

type HoverState =
  | { kind: "booking"; booking: Booking; date: string; rect: DOMRect }
  | { kind: "venue"; block: VenueBlock; venue: Venue; rect: DOMRect }
  | { kind: "bulk"; block: BulkRoomBlock; rect: DOMRect };

type UnifiedModalState =
  | { open: false }
  | { open: true; editingBulkId?: string; editingVenueId?: string };

type CellValue =
  | { kind: "booking"; booking: Booking; fromRoomId: string; isOverridden: boolean }
  | { kind: "bulk"; block: BulkRoomBlock };

type BulkCatRow = { catId: string; count: number };

type MaintRoomRow = { catId: string; roomIds: string[] };
type MaintVenueRow = { type: string; venueIds: string[] };

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function nightsBetween(checkin: string, checkout: string): number {
  if (!checkin || !checkout || checkout <= checkin) return 0;
  return Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

type DragState = {
  bookingId: string;
  // The booking's original allocated room for this night (i.e. the slot key).
  fromRoomId: string;
  // The room currently being displayed for the dragged cell (override target if any).
  currentRoomId: string;
  sourceDate: string;
};

type PendingUpgrade = {
  bookingId: string;
  date: string;
  fromRoomId: string;
  toRoomId: string;
  fromCategory: string;
  fromCategoryName: string;
  toCategory: string;
  toCategoryName: string;
};

export default function RoomChartPage() {
  const router = useRouter();
  const {
    bookings,
    rooms,
    roomInventory,
    venues,
    venueTypes,
    venueBlocks,
    addVenueBlock,
    updateVenueBlock,
    removeVenueBlock,
    bulkRoomBlocks,
    addBulkRoomBlock,
    updateBulkRoomBlock,
    removeBulkRoomBlock,
    applyNightOverride,
    clearNightOverride,
    currentUser,
    showNotif,
  } = useApp();

  const [offset, setOffset] = useState(0);
  const [today, setToday] = useState("");
  const [hover, setHover] = useState<HoverState | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Unified block modal
  const [unifiedModal, setUnifiedModal] = useState<UnifiedModalState>({ open: false });
  const [uMode, setUMode] = useState<"book" | "maintenance">("book");
  const [uName, setUName] = useState("");
  const [uCheckin, setUCheckin] = useState("");
  const [uCheckout, setUCheckout] = useState("");
  const [uPax, setUPax] = useState("");
  const [uAmount, setUAmount] = useState("");
  const [uBulkOpen, setUBulkOpen] = useState(false);
  const [uCatRows, setUCatRows] = useState<BulkCatRow[]>([{ catId: "", count: 1 }]);
  const [uVenueOpen, setUVenueOpen] = useState(false);
  const [uVenueIds, setUVenueIds] = useState<string[]>([""]);

  // Maintenance mode fields (dates reuse uCheckin/uCheckout; end date inclusive)
  const [mReason, setMReason] = useState("");
  const [mRoomRows, setMRoomRows] = useState<MaintRoomRow[]>([{ catId: "", roomIds: [] }]);
  const [mVenueRows, setMVenueRows] = useState<MaintVenueRow[]>([{ type: "", venueIds: [] }]);

  // Bulk block detail/delete modal
  const [bulkDetail, setBulkDetail] = useState<BulkRoomBlock | null>(null);

  // Drag-and-drop state
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    roomId: string;
    date: string;
  } | null>(null);

  // Room upgrade modal state
  const [pendingUpgrade, setPendingUpgrade] = useState<PendingUpgrade | null>(
    null
  );
  const [upKind, setUpKind] = useState<"complimentary" | "paid">(
    "complimentary"
  );
  const [upAmount, setUpAmount] = useState("");

  useEffect(() => {
    setToday(todayStr());
  }, []);

  const dates = useMemo(() => {
    const out: string[] = [];
    if (!today) return out;
    const start = new Date(today);
    start.setDate(start.getDate() + offset);
    for (let i = 0; i < DAYS_WINDOW; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      out.push(d.toISOString().split("T")[0]);
    }
    return out;
  }, [offset, today]);

  // Month dropdown: current month + next 12 months
  const monthOptions = useMemo(() => {
    if (!today) return [];
    const base = new Date(today + "T00:00:00");
    base.setDate(1);
    return Array.from({ length: 13 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      };
    });
  }, [today]);

  const selectedMonth = useMemo(() => {
    if (!today) return "";
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [today, offset]);

  const goToMonth = (ym: string) => {
    if (!today) return;
    const [y, m] = ym.split("-").map(Number);
    const target = new Date(y, m - 1, 1);
    const todayDate = new Date(today + "T00:00:00");
    const diff = Math.round((target.getTime() - todayDate.getTime()) / 86400000);
    setOffset(Math.max(0, diff));
  };

  const goNextMonth = () => {
    if (!today) return;
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() + offset);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const todayDate = new Date(today + "T00:00:00");
    const diff = Math.round((next.getTime() - todayDate.getTime()) / 86400000);
    setOffset(Math.max(0, diff));
  };

  // Per-night cell map: tracks the booking, original slot, and any active
  // override for each (effective room, date) cell.
  const cellMap = useMemo(() => {
    const map: Record<string, CellValue> = {};
    bookings
      .filter(
        (b) =>
          b.allocatedRooms.length > 0 &&
          (b.status === "Tentative" ||
            b.status === "Confirmed" ||
            b.status === "Completed")
      )
      .forEach((b) => {
        // Per-segment allocations paint each room only for its segment's date
        // range; legacy bookings paint all rooms across the whole stay.
        const segsWithAlloc = (b.segments ?? []).filter((s) => Array.isArray(s.allocatedRooms));
        const spans = segsWithAlloc.length > 0
          ? segsWithAlloc.map((s) => ({ checkin: s.checkin, checkout: s.checkout, roomIds: s.allocatedRooms ?? [] }))
          : [{ checkin: b.checkin, checkout: b.checkout, roomIds: b.allocatedRooms }];
        spans.forEach((span) => {
          const cur = new Date(span.checkin);
          const end = new Date(span.checkout);
          while (cur < end) {
            const ds = cur.toISOString().split("T")[0];
            span.roomIds.forEach((origRoomId) => {
              const override = b.nightOverrides?.find(
                (o) => o.date === ds && o.fromRoomId === origRoomId
              );
              const effectiveRoomId = override ? override.toRoomId : origRoomId;
              map[`${effectiveRoomId}|${ds}`] = {
                kind: "booking",
                booking: b,
                fromRoomId: origRoomId,
                isOverridden: !!override,
              };
            });
            cur.setDate(cur.getDate() + 1);
          }
        });
      });
    bulkRoomBlocks.forEach((blk) => {
      const cur = new Date(blk.checkin);
      const end = new Date(blockOccupancyEnd(blk.checkin, blk.checkout));
      while (cur < end) {
        const ds = cur.toISOString().split("T")[0];
        blk.rows.forEach((row) =>
          row.roomIds.forEach((roomId) => {
            map[`${roomId}|${ds}`] = { kind: "bulk", block: blk };
          })
        );
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [bookings, bulkRoomBlocks]);

  const venueBlockMap = useMemo(() => {
    const map: Record<string, VenueBlock> = {};
    venueBlocks.forEach((vb) => {
      const cur = new Date(vb.checkin);
      const end = new Date(blockOccupancyEnd(vb.checkin, vb.checkout));
      while (cur < end) {
        const ds = cur.toISOString().split("T")[0];
        map[vb.venueId + "|" + ds] = vb;
        cur.setDate(cur.getDate() + 1);
      }
    });
    return map;
  }, [venueBlocks]);

  // Categories in master-setup order, plus any type still referenced by a venue
  const allVenueTypes = useMemo(() => {
    const out = [...venueTypes];
    venues.forEach((v) => {
      if (!out.includes(v.type)) out.push(v.type);
    });
    return out;
  }, [venueTypes, venues]);

  // Venues sorted by type then name for stable row order
  const sortedVenues = useMemo(() => {
    const orderOf = (t: VenueType) => {
      const i = allVenueTypes.indexOf(t);
      return i === -1 ? allVenueTypes.length : i;
    };
    return [...venues]
      .filter((v) => v.active)
      .sort((a, b) => {
        const ai = orderOf(a.type);
        const bi = orderOf(b.type);
        if (ai !== bi) return ai - bi;
        return a.name.localeCompare(b.name);
      });
  }, [venues, allVenueTypes]);

  const venueById = useMemo(() => {
    const m: Record<string, Venue> = {};
    venues.forEach((v) => (m[v.id] = v));
    return m;
  }, [venues]);

  // Chart rows: category blocks in master order, labels sorted numerically
  const sortedInventory = useMemo(
    () => sortRoomInventory(roomInventory, rooms),
    [roomInventory, rooms]
  );

  const showHover = (state: HoverState) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHover(state);
  };
  const hideHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(null), 80);
  };

  useEffect(() => {
    const onScroll = () => setHover(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);

  // Auto-scroll the main pane while a drag hovers near its top/bottom edge —
  // native HTML5 drag never scrolls a container, so rows outside the visible
  // window would otherwise be unreachable as drop targets. Scrolling is
  // time-based and driven by both a rAF loop (smooth when the pointer sits
  // still) and the dragover events themselves (works even when the browser
  // throttles rAF).
  useEffect(() => {
    if (!drag) return;
    const scroller = document.getElementById("views");
    if (!scroller) return;
    const ZONE = 64; // px from pane edge where scrolling kicks in
    const MAX_SPEED = 900; // px per second at the very edge
    let pointerY: number | null = null;
    let lastT = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = Math.min(Math.max(now - lastT, 0) / 1000, 0.1);
      lastT = now;
      if (pointerY === null || dt === 0) return;
      const rect = scroller.getBoundingClientRect();
      const fromTop = pointerY - rect.top;
      const fromBottom = rect.bottom - pointerY;
      if (fromTop < ZONE) {
        scroller.scrollTop -= MAX_SPEED * (1 - Math.max(fromTop, 0) / ZONE) * dt;
      } else if (fromBottom < ZONE) {
        scroller.scrollTop += MAX_SPEED * (1 - Math.max(fromBottom, 0) / ZONE) * dt;
      }
    };
    const loop = (now: number) => {
      step(now);
      raf = requestAnimationFrame(loop);
    };
    const onDragOver = (e: DragEvent) => {
      pointerY = e.clientY;
      step(performance.now());
    };
    const onDragLeave = (e: DragEvent) => {
      // Pointer left the window: stop scrolling until it comes back.
      if (e.relatedTarget === null) pointerY = null;
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      cancelAnimationFrame(raf);
    };
  }, [drag]);

  const unalloc = bookings.filter(
    (b) =>
      (b.status === "Confirmed" || b.status === "Tentative") &&
      b.allocatedRooms.length === 0
  );

  // ─── Unified block modal handlers ───
  const resetUnifiedForm = () => {
    const t = todayStr();
    setUMode("book");
    setUName("");
    setUCheckin(t);
    setUCheckout(addDays(t, 1));
    setUPax("");
    setUAmount("");
    setUBulkOpen(false);
    setUCatRows([{ catId: "", count: 1 }]);
    setUVenueOpen(false);
    setUVenueIds([""]);
    setMReason("");
    setMRoomRows([{ catId: "", roomIds: [] }]);
    setMVenueRows([{ type: "", venueIds: [] }]);
  };

  const openUnifiedCreate = () => {
    resetUnifiedForm();
    setHover(null);
    setUnifiedModal({ open: true });
  };

  const openVenueEdit = (block: VenueBlock) => {
    if (block.status === "Maintenance") {
      resetUnifiedForm();
      setUMode("maintenance");
      setUCheckin(block.checkin);
      setUCheckout(addDays(block.checkout, -1));
      setMReason(block.reason || "");
      setMVenueRows([{ type: venueById[block.venueId]?.type || "", venueIds: [block.venueId] }]);
      setHover(null);
      setUnifiedModal({ open: true, editingVenueId: block.id });
      return;
    }
    setUMode("book");
    setUName(block.name);
    setUCheckin(block.checkin);
    setUCheckout(block.checkout);
    setUPax(String(block.pax || ""));
    setUAmount(String(block.amount || ""));
    setUVenueOpen(true);
    setUVenueIds([block.venueId]);
    setUBulkOpen(false);
    setUCatRows([{ catId: "", count: 1 }]);
    setHover(null);
    setUnifiedModal({ open: true, editingVenueId: block.id });
  };

  const openBulkEdit = (blk: BulkRoomBlock) => {
    if (blk.status === "Maintenance") {
      resetUnifiedForm();
      setUMode("maintenance");
      setUCheckin(blk.checkin);
      setUCheckout(addDays(blk.checkout, -1));
      setMReason(blk.reason || "");
      setMRoomRows(blk.rows.map((r) => ({ catId: r.catId, roomIds: [...r.roomIds] })));
      setBulkDetail(null);
      setHover(null);
      setUnifiedModal({ open: true, editingBulkId: blk.id });
      return;
    }
    setUMode("book");
    setUName(blk.guestName);
    setUCheckin(blk.checkin);
    setUCheckout(blk.checkout);
    setUPax(String(blk.pax || ""));
    setUAmount(String(blk.amount || ""));
    setUBulkOpen(true);
    setUCatRows(blk.rows.map((r) => ({ catId: r.catId, count: r.roomIds.length })));
    setUVenueOpen(false);
    setUVenueIds([""]);
    setBulkDetail(null);
    setHover(null);
    setUnifiedModal({ open: true, editingBulkId: blk.id });
  };

  const closeUnifiedModal = () => setUnifiedModal({ open: false });

  const overlapsExisting = (
    venueId: string,
    checkin: string,
    checkout: string,
    ignoreId?: string
  ): VenueBlock | null => {
    return (
      venueBlocks.find(
        (vb) =>
          vb.id !== ignoreId &&
          vb.venueId === venueId &&
          vb.checkin < blockOccupancyEnd(checkin, checkout) &&
          checkin < blockOccupancyEnd(vb.checkin, vb.checkout)
      ) || null
    );
  };

  const bulkAvailability = useMemo(() => {
    if (!uCheckin || !uCheckout || uCheckout < uCheckin) return {} as Record<string, number>;
    // Same-day block (dayout) occupies its single date.
    const effCheckout = blockOccupancyEnd(uCheckin, uCheckout);
    const editingBulkId = unifiedModal.open ? unifiedModal.editingBulkId : undefined;
    const result: Record<string, number> = {};
    rooms.forEach((r) => {
      result[r.id] = findAvailableRoomIds(
        r.id, uCheckin, effCheckout, bookings, roomInventory,
        undefined, bulkRoomBlocks, editingBulkId
      ).length;
    });
    return result;
  }, [uCheckin, uCheckout, bookings, roomInventory, bulkRoomBlocks, rooms, unifiedModal]);

  // Maintenance mode: which physical rooms are free per category for the
  // selected range. End date is inclusive, so occupancy runs to end + 1.
  const maintDatesValid = !!uCheckin && !!uCheckout && uCheckout >= uCheckin;
  const maintFreeRooms = useMemo(() => {
    if (!maintDatesValid) return {} as Record<string, Set<string>>;
    const effEnd = addDays(uCheckout, 1);
    const editingBulkId = unifiedModal.open ? unifiedModal.editingBulkId : undefined;
    const out: Record<string, Set<string>> = {};
    rooms.forEach((r) => {
      out[r.id] = new Set(
        findAvailableRoomIds(
          r.id, uCheckin, effEnd, bookings, roomInventory,
          undefined, bulkRoomBlocks, editingBulkId
        )
      );
    });
    return out;
  }, [maintDatesValid, uCheckin, uCheckout, bookings, roomInventory, bulkRoomBlocks, rooms, unifiedModal]);

  const maintVenueFree = (venueId: string): boolean => {
    if (!maintDatesValid) return false;
    const editingVenueId = unifiedModal.open ? unifiedModal.editingVenueId : undefined;
    return !overlapsExisting(venueId, uCheckin, addDays(uCheckout, 1), editingVenueId);
  };

  const saveMaintenance = () => {
    if (!maintDatesValid) { showNotif("Pick valid start and end dates", "error"); return; }
    const editingBulkId = unifiedModal.open ? unifiedModal.editingBulkId : undefined;
    const editingVenueId = unifiedModal.open ? unifiedModal.editingVenueId : undefined;
    const effEnd = addDays(uCheckout, 1);

    // Merge duplicate category rows and drop empty ones
    const byCat = new Map<string, Set<string>>();
    mRoomRows.forEach((row) => {
      if (!row.catId || row.roomIds.length === 0) return;
      const set = byCat.get(row.catId) ?? new Set<string>();
      row.roomIds.forEach((id) => set.add(id));
      byCat.set(row.catId, set);
    });
    const venueIds = [...new Set(mVenueRows.flatMap((r) => r.venueIds))];

    if (byCat.size === 0 && venueIds.length === 0) {
      showNotif("Select at least one room or venue to block", "error");
      return;
    }

    for (const [catId, ids] of byCat.entries()) {
      const free = maintFreeRooms[catId] ?? new Set<string>();
      const taken = [...ids].filter((id) => !free.has(id));
      if (taken.length > 0) {
        const labels = taken.map((id) => roomInventory.find((r) => r.id === id)?.label ?? id);
        showNotif(`${labels.join(", ")} not free for the selected dates`, "error");
        return;
      }
    }
    for (const vid of venueIds) {
      const conflict = overlapsExisting(vid, uCheckin, effEnd, editingVenueId);
      if (conflict) {
        showNotif(`${venueById[vid]?.name || "Venue"} already booked (${fmtIN(conflict.checkin)} to ${fmtIN(conflict.checkout)})`, "error");
        return;
      }
    }

    const reason = mReason.trim();

    if (byCat.size > 0) {
      const block: BulkRoomBlock = {
        id: editingBulkId || ("mnt-" + uid()),
        label: "Maintenance",
        guestName: reason || "Maintenance",
        checkin: uCheckin,
        checkout: effEnd,
        pax: 0,
        amount: 0,
        status: "Maintenance",
        reason,
        rows: [...byCat.entries()].map(([catId, ids]) => ({
          catId,
          catName: rooms.find((r) => r.id === catId)?.name ?? catId,
          roomIds: [...ids],
        })),
        createdBy: currentUser,
        createdAt: new Date().toISOString(),
      };
      if (editingBulkId) updateBulkRoomBlock(editingBulkId, block);
      else addBulkRoomBlock(block);
    } else if (editingBulkId) {
      // Every room was deselected while editing — the block is gone
      removeBulkRoomBlock(editingBulkId);
    }

    const newVenueBlock = (venueId: string): VenueBlock => ({
      id: "mnt-" + uid(),
      venueId,
      checkin: uCheckin,
      checkout: effEnd,
      name: "Maintenance",
      pax: 0,
      amount: 0,
      status: "Maintenance",
      reason,
      createdBy: currentUser,
      createdAt: todayStr(),
    });

    if (editingVenueId) {
      const [first, ...rest] = venueIds;
      if (!first) {
        removeVenueBlock(editingVenueId);
      } else {
        updateVenueBlock(editingVenueId, {
          venueId: first, checkin: uCheckin, checkout: effEnd,
          name: "Maintenance", pax: 0, amount: 0, status: "Maintenance", reason,
        });
        rest.forEach((vid) => addVenueBlock(newVenueBlock(vid)));
      }
    } else {
      venueIds.forEach((vid) => addVenueBlock(newVenueBlock(vid)));
    }

    showNotif("Blocked for maintenance", "success");
    closeUnifiedModal();
  };

  const saveUnified = (status: "Tentative" | "Confirmed") => {
    if (!uName.trim()) { showNotif("Enter group / guest name", "error"); return; }
    if (!uCheckin || !uCheckout || uCheckout < uCheckin) { showNotif("Pick valid check-in and check-out dates", "error"); return; }
    if (!uBulkOpen && !uVenueOpen) { showNotif("Expand at least one section — Bulk Rooms or Venue", "error"); return; }

    const pax = parseInt(uPax) || 0;
    const amount = parseFloat(uAmount) || 0;
    const editingBulkId = unifiedModal.open ? unifiedModal.editingBulkId : undefined;
    const editingVenueId = unifiedModal.open ? unifiedModal.editingVenueId : undefined;

    if (uVenueOpen) {
      const venueIds = [...new Set(uVenueIds.filter(Boolean))];
      if (venueIds.length === 0) { showNotif("Pick a venue in the Venue section", "error"); return; }
      for (const vid of venueIds) {
        const conflict = overlapsExisting(vid, uCheckin, uCheckout, editingVenueId);
        if (conflict) {
          const vname = venueById[conflict.venueId]?.name || "Venue";
          showNotif(`${vname} already booked (${fmtIN(conflict.checkin)} to ${fmtIN(conflict.checkout)})`, "error");
          return;
        }
      }
      // Amount is entered once for the whole group; it lives on the first
      // venue block so hover cards don't repeat it per venue.
      const mkVenueBlock = (venueId: string, amt: number): VenueBlock => ({
        id: uid(), venueId, checkin: uCheckin, checkout: uCheckout,
        name: uName.trim(), pax, amount: amt, status,
        createdBy: currentUser, createdAt: todayStr(),
      });
      if (editingVenueId) {
        const [first, ...rest] = venueIds;
        updateVenueBlock(editingVenueId, { venueId: first, checkin: uCheckin, checkout: uCheckout, name: uName.trim(), pax, amount, status });
        rest.forEach((vid) => addVenueBlock(mkVenueBlock(vid, 0)));
      } else {
        venueIds.forEach((vid, i) => addVenueBlock(mkVenueBlock(vid, i === 0 ? amount : 0)));
      }
    }

    if (uBulkOpen) {
      const rows: BulkRoomBlockRow[] = [];
      for (const row of uCatRows) {
        if (!row.catId || row.count <= 0) continue;
        const available = findAvailableRoomIds(
          row.catId, uCheckin, blockOccupancyEnd(uCheckin, uCheckout), bookings, roomInventory,
          undefined, bulkRoomBlocks, editingBulkId
        );
        if (available.length < row.count) {
          const catName = rooms.find((r) => r.id === row.catId)?.name ?? row.catId;
          showNotif(`Only ${available.length} ${catName} available for selected dates`, "error");
          return;
        }
        rows.push({
          catId: row.catId,
          catName: rooms.find((r) => r.id === row.catId)?.name ?? row.catId,
          roomIds: available.slice(0, row.count),
        });
      }
      if (rows.length === 0) { showNotif("Add at least one room category in the Bulk Rooms section", "error"); return; }
      const block: BulkRoomBlock = {
        id: editingBulkId || ("brb-" + uid()),
        label: uName.trim(),
        guestName: uName.trim(),
        checkin: uCheckin,
        checkout: uCheckout,
        pax,
        amount,
        status,
        rows,
        createdBy: currentUser,
        createdAt: new Date().toISOString(),
      };
      if (editingBulkId) {
        updateBulkRoomBlock(editingBulkId, block);
      } else {
        addBulkRoomBlock(block);
      }
    }

    showNotif(status === "Tentative" ? "Block saved as tentative" : "Block confirmed", "success");
    closeUnifiedModal();
  };

  // ─── Drag & drop handlers (per-night room override) ───
  const isBookingDraggable = (b: Booking) =>
    b.status === "Tentative" || b.status === "Confirmed";

  // For a single night, is target room free? Free means: no other booking holds
  // it that night AND no other override of any booking redirects to it.
  const nightSlotFree = (
    targetRoomId: string,
    date: string,
    excludeBookingId: string,
    excludeOverrideFromRoomId?: string
  ): { ok: true } | { ok: false; reason: string } => {
    const inv = roomInventory.find((r) => r.id === targetRoomId);
    if (!inv) return { ok: false, reason: "Room not found" };
    if (!inv.active)
      return {
        ok: false,
        reason: `${inv.label} is blocked${
          inv.blockedReason ? ` (${inv.blockedReason})` : ""
        }`,
      };
    for (const b of bookings) {
      if (
        b.status !== "Tentative" &&
        b.status !== "Confirmed" &&
        b.status !== "Completed"
      )
        continue;
      // Rooms this booking actually holds on this date (per-segment aware)
      for (const origRoomId of roomsHeldOnDate(b, date)) {
        const override = b.nightOverrides?.find(
          (o) => o.date === date && o.fromRoomId === origRoomId
        );
        const effectiveRoomId = override ? override.toRoomId : origRoomId;
        if (effectiveRoomId !== targetRoomId) continue;
        // It's the same booking and same slot we're moving from → free for us
        if (
          b.id === excludeBookingId &&
          excludeOverrideFromRoomId &&
          origRoomId === excludeOverrideFromRoomId
        ) {
          continue;
        }
        return {
          ok: false,
          reason: `${inv.label} is already taken on ${fmtIN(date)} by ${b.guest}`,
        };
      }
    }
    return { ok: true };
  };

  const handleDrop = (targetRoomId: string, targetDate: string) => {
    if (!drag) return;
    const booking = bookings.find((b) => b.id === drag.bookingId);
    if (!booking) {
      setDrag(null);
      setDropTarget(null);
      return;
    }
    if (!isBookingDraggable(booking)) {
      showNotif("Only Tentative or Confirmed bookings can be moved", "error");
      setDrag(null);
      setDropTarget(null);
      return;
    }

    // Per-night model: date column is fixed to the source date.
    if (targetDate !== drag.sourceDate) {
      showNotif(
        "Drag to a different room on the same date to swap that night",
        "error"
      );
      setDrag(null);
      setDropTarget(null);
      return;
    }

    const date = drag.sourceDate;
    const fromRoomId = drag.fromRoomId; // booking's original slot

    // No-op: same effective room (i.e. dropping back on itself)
    if (targetRoomId === drag.currentRoomId) {
      setDrag(null);
      setDropTarget(null);
      return;
    }

    // Dropping back to the booking's original room for this night → clear override
    if (targetRoomId === fromRoomId) {
      const free = nightSlotFree(targetRoomId, date, booking.id, fromRoomId);
      if (!free.ok) {
        showNotif(free.reason, "error");
        setDrag(null);
        setDropTarget(null);
        return;
      }
      clearNightOverride(booking.id, date, fromRoomId);
      showNotif(
        `${booking.guest} — restored to original room for ${fmtIN(date)}`,
        "success"
      );
      setDrag(null);
      setDropTarget(null);
      return;
    }

    // Validate target slot availability for this single night
    const free = nightSlotFree(targetRoomId, date, booking.id, fromRoomId);
    if (!free.ok) {
      showNotif(free.reason, "error");
      setDrag(null);
      setDropTarget(null);
      return;
    }

    const fromInv = roomInventory.find((r) => r.id === fromRoomId);
    const toInv = roomInventory.find((r) => r.id === targetRoomId);
    const fromCat = fromInv?.cat || "";
    const toCat = toInv?.cat || "";

    if (fromCat && toCat && fromCat !== toCat) {
      const fromCatName =
        rooms.find((r) => r.id === fromCat)?.name || fromInv?.type || fromCat;
      const toCatName =
        rooms.find((r) => r.id === toCat)?.name || toInv?.type || toCat;
      setPendingUpgrade({
        bookingId: booking.id,
        date,
        fromRoomId,
        toRoomId: targetRoomId,
        fromCategory: fromCat,
        fromCategoryName: fromCatName,
        toCategory: toCat,
        toCategoryName: toCatName,
      });
      setUpKind("complimentary");
      setUpAmount("");
    } else {
      // Same category — apply override silently
      applyNightOverride(booking.id, {
        date,
        fromRoomId,
        toRoomId: targetRoomId,
      });
      showNotif(
        `${booking.guest} — ${fmtIN(date)} moved to ${toInv?.label}`,
        "success"
      );
    }

    setDrag(null);
    setDropTarget(null);
  };

  const confirmUpgrade = () => {
    if (!pendingUpgrade) return;
    const amount = upKind === "paid" ? parseInt(upAmount) || 0 : 0;
    if (upKind === "paid" && amount <= 0) {
      showNotif("Enter a valid upgrade charge", "error");
      return;
    }
    const upgrade: RoomNightUpgrade = {
      fromCategory: pendingUpgrade.fromCategory,
      fromCategoryName: pendingUpgrade.fromCategoryName,
      toCategory: pendingUpgrade.toCategory,
      toCategoryName: pendingUpgrade.toCategoryName,
      upgradeDate: todayStr(),
      kind: upKind,
      extraAmount: amount,
      by: currentUser,
    };
    applyNightOverride(pendingUpgrade.bookingId, {
      date: pendingUpgrade.date,
      fromRoomId: pendingUpgrade.fromRoomId,
      toRoomId: pendingUpgrade.toRoomId,
      upgrade,
    });
    showNotif(
      upKind === "complimentary"
        ? `${fmtIN(pendingUpgrade.date)} upgraded to ${pendingUpgrade.toCategoryName} (complimentary)`
        : `${fmtIN(pendingUpgrade.date)} upgraded to ${pendingUpgrade.toCategoryName} (₹${amount} charged)`,
      "success"
    );
    setPendingUpgrade(null);
    setUpAmount("");
  };

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Room Chart</h2>
        </div>
        <div className="pg-hd-actions">
          <button className="btn btn-ghost btn-sm" onClick={goNextMonth}>
            Next Month
          </button>
          <select
            value={selectedMonth}
            onChange={(e) => goToMonth(e.target.value)}
            style={{
              height: 32,
              padding: "0 10px",
              fontSize: 13,
              border: "1px solid var(--bd)",
              borderRadius: "var(--r2)",
              background: "var(--surf)",
              color: "var(--t1)",
              cursor: "pointer",
            }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={openUnifiedCreate}>
            Block
          </button>
        </div>
      </div>

      {unalloc.length > 0 && (
        <div className="unalloc-banner">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amb)" }}>
              {unalloc.length} booking{unalloc.length > 1 ? "s" : ""} awaiting room allocation
            </div>
            <div className="unalloc-banner-cards">
              {unalloc.map((b) => (
                <div
                  key={b.id}
                  className="unalloc-card"
                  onClick={() => router.push(`/bookings/${b.id}`)}
                >
                  <div className="unalloc-card-name">{b.guest}</div>
                  <div className="unalloc-card-meta">
                    {fmtIN(b.checkin)} · {[...new Set(b.segments.flatMap((s) => s.rooms.map((r) => r.roomName)).filter(Boolean))].join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rc-wrap">
        <div className="rc-hd">
          <h3>Availability</h3>
          <div
            className="rc-legend"
            style={{ marginLeft: "auto", padding: 0, border: "none", background: "transparent", gap: 12 }}
          >
            <div className="rc-legend-item">
              <div className="rc-legend-dot" style={{ background: "var(--grn-bg)", border: "1px solid var(--grn)" }}></div>
              Confirmed
            </div>
            <div className="rc-legend-item">
              <div className="rc-legend-dot" style={{ background: "var(--amb-bg)", border: "1px solid var(--amb)" }}></div>
              Tentative
            </div>
            <div className="rc-legend-item">
              <div
                className="rc-legend-dot"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, var(--red-bg), var(--red-bg) 2px, var(--red) 2px, var(--red) 4px)",
                  border: "1px solid var(--red)",
                }}
              ></div>
              Blocked
            </div>
            <div style={{ width: 1, height: 16, background: "var(--bd2)", margin: "0 6px" }}></div>
            <div className="rc-legend-item">
              <div
                className="rc-legend-dot"
                style={{ background: "var(--pur-bg)", border: "1px solid var(--pur)" }}
              ></div>
              Pets
            </div>
          </div>
        </div>
        <div className="rc-table-wrap">
          <table className="rc-table">
            <thead>
              <tr>
                <th className="rc-room-col">Room / Venue</th>
                {dates.map((d) => {
                  const dt = new Date(d);
                  const isToday = d === today;
                  const isWknd = dt.getDay() === 0 || dt.getDay() === 6;
                  return (
                    <th
                      key={d}
                      className={isToday ? "rc-today-hd" : ""}
                      style={isWknd ? { color: "var(--acc)", opacity: 0.8 } : undefined}
                    >
                      <div style={{ lineHeight: 1.2 }}>
                        <div>{String(dt.getDate()).padStart(2, "0")}/{String(dt.getMonth() + 1).padStart(2, "0")}</div>
                        <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.7, marginTop: 2 }}>
                          {dt.toLocaleDateString("en-IN", { weekday: "short" })}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedVenues.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={dates.length + 1}
                      style={{
                        background: "var(--surf2)",
                        padding: "6px 12px",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".5px",
                        color: "var(--t3)",
                        borderBottom: "1px solid var(--bd)",
                      }}
                    >
                      Venues
                    </td>
                  </tr>
                  {sortedVenues.map((venue) => (
                    <tr key={`v-${venue.id}`}>
                      <td className="rc-room-label">
                        {venue.name}
                        <small>{venue.type}</small>
                      </td>
                      {dates.map((d) => {
                        const isToday = d === today;
                        const block = venueBlockMap[venue.id + "|" + d];
                        if (block && block.status === "Maintenance") {
                          return (
                            <td
                              key={d}
                              className={isToday ? "rc-today" : ""}
                              style={{
                                background:
                                  "repeating-linear-gradient(45deg, var(--red-bg), var(--red-bg) 4px, var(--red) 4px, var(--red) 6px)",
                                cursor: "pointer",
                              }}
                              title={block.reason ? `Maintenance — ${block.reason}` : "Maintenance"}
                              onClick={() => openVenueEdit(block)}
                              onMouseEnter={(e) =>
                                showHover({
                                  kind: "venue",
                                  block,
                                  venue,
                                  rect: e.currentTarget.getBoundingClientRect(),
                                })
                              }
                              onMouseLeave={hideHover}
                            ></td>
                          );
                        }
                        if (block) {
                          return (
                            <td
                              key={d}
                              className={isToday ? "rc-today" : ""}
                              style={{ padding: 4 }}
                            >
                              <div
                                className={`rc-cell-booked${block.status === "Tentative" ? " status-tentative" : ""}`}
                                onClick={() => openVenueEdit(block)}
                                onMouseEnter={(e) =>
                                  showHover({
                                    kind: "venue",
                                    block,
                                    venue,
                                    rect: e.currentTarget.getBoundingClientRect(),
                                  })
                                }
                                onMouseLeave={hideHover}
                              >
                                {block.name.split(" ")[0]}
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={d} className={isToday ? "rc-today" : ""}></td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td
                      colSpan={dates.length + 1}
                      style={{
                        background: "var(--surf2)",
                        padding: "6px 12px",
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".5px",
                        color: "var(--t3)",
                        borderBottom: "1px solid var(--bd)",
                        borderTop: "1px solid var(--bd)",
                      }}
                    >
                      Rooms
                    </td>
                  </tr>
                </>
              )}

              {sortedInventory.map((room) => (
                <tr key={room.id} style={!room.active ? { opacity: 0.55 } : undefined}>
                  <td
                    className="rc-room-label"
                    title={
                      !room.active
                        ? room.blockedReason
                          ? `Blocked — ${room.blockedReason}`
                          : "Blocked"
                        : undefined
                    }
                  >
                    {room.label}
                    {!room.active && (
                      <span
                        className="badge"
                        style={{
                          marginLeft: 6,
                          background: "var(--bd2)",
                          color: "var(--t2)",
                          fontSize: 8,
                        }}
                      >
                        Blocked
                      </span>
                    )}
                    <small>{room.type}</small>
                  </td>
                  {dates.map((d) => {
                    const isToday = d === today;
                    const cell = cellMap[room.id + "|" + d];
                    const booking = cell?.kind === "booking" ? cell.booking : undefined;
                    const bulkCell = cell?.kind === "bulk" ? cell : undefined;
                    const isDropHover =
                      dropTarget?.roomId === room.id && dropTarget?.date === d;
                    if (!room.active) {
                      return (
                        <td
                          key={d}
                          className={isToday ? "rc-today" : ""}
                          style={{
                            background:
                              "repeating-linear-gradient(45deg, var(--red-bg), var(--red-bg) 4px, var(--red) 4px, var(--red) 6px)",
                          }}
                          title={room.blockedReason || "Blocked"}
                        ></td>
                      );
                    }
                    if (bulkCell && bulkCell.block.status === "Maintenance") {
                      const blk = bulkCell.block;
                      return (
                        <td
                          key={d}
                          className={isToday ? "rc-today" : ""}
                          style={{
                            background:
                              "repeating-linear-gradient(45deg, var(--red-bg), var(--red-bg) 4px, var(--red) 4px, var(--red) 6px)",
                            cursor: "pointer",
                          }}
                          title={blk.reason ? `Maintenance — ${blk.reason}` : "Maintenance"}
                          onClick={() => { setBulkDetail(blk); setHover(null); }}
                          onMouseEnter={(e) => showHover({ kind: "bulk", block: blk, rect: e.currentTarget.getBoundingClientRect() })}
                          onMouseLeave={hideHover}
                        ></td>
                      );
                    }
                    if (bulkCell) {
                      const blk = bulkCell.block;
                      const cls = "rc-cell-booked" + (blk.status === "Tentative" ? " status-tentative" : "");
                      return (
                        <td key={d} className={isToday ? "rc-today" : ""} style={{ padding: 4 }}>
                          <div
                            className={cls}
                            style={{ cursor: "pointer" }}
                            onClick={() => { setBulkDetail(blk); setHover(null); }}
                            onMouseEnter={(e) => showHover({ kind: "bulk", block: blk, rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={hideHover}
                          >
                            {(blk.label || blk.guestName).split(" ")[0]}
                          </div>
                        </td>
                      );
                    }
                    if (booking && cell && cell.kind === "booking") {
                      let cls = "rc-cell-booked";
                      if (booking.pets > 0) cls += " status-pet";
                      else if (booking.status === "Completed") cls += " status-completed";
                      else if (booking.status === "Tentative") cls += " status-tentative";
                      const draggable = isBookingDraggable(booking);
                      // For per-night drag: drop is allowed only on the same date column.
                      const isDragSourceDate =
                        drag !== null &&
                        drag.bookingId === booking.id &&
                        drag.sourceDate === d;
                      return (
                        <td
                          key={d}
                          className={isToday ? "rc-today" : ""}
                          style={{
                            padding: 4,
                            outline: isDropHover
                              ? "2px solid var(--acc)"
                              : undefined,
                            outlineOffset: isDropHover ? -2 : undefined,
                          }}
                          onDragOver={(e) => {
                            if (!drag) return;
                            if (isDragSourceDate) {
                              e.preventDefault();
                              setDropTarget({ roomId: room.id, date: d });
                            }
                          }}
                          onDrop={(e) => {
                            if (!drag || !isDragSourceDate) return;
                            e.preventDefault();
                            handleDrop(room.id, d);
                          }}
                        >
                          <div
                            className={cls}
                            draggable={draggable}
                            onDragStart={(e) => {
                              if (!draggable) {
                                e.preventDefault();
                                return;
                              }
                              setDrag({
                                bookingId: booking.id,
                                fromRoomId: cell.fromRoomId,
                                currentRoomId: room.id,
                                sourceDate: d,
                              });
                              setHover(null);
                              e.dataTransfer.effectAllowed = "move";
                              try {
                                e.dataTransfer.setData("text/plain", booking.id);
                              } catch {}
                            }}
                            onDragEnd={() => {
                              setDrag(null);
                              setDropTarget(null);
                            }}
                            onClick={() => {
                              if (drag) return;
                              router.push(`/bookings/${booking.id}`);
                            }}
                            onMouseEnter={(e) =>
                              showHover({
                                kind: "booking",
                                booking,
                                date: d,
                                rect: e.currentTarget.getBoundingClientRect(),
                              })
                            }
                            onMouseLeave={hideHover}
                            style={{
                              opacity: drag?.bookingId === booking.id ? 0.5 : 1,
                              cursor: draggable ? "grab" : "pointer",
                              // Subtle ring for nights with overrides so they're visually distinct
                              boxShadow: cell.kind === "booking" && cell.isOverridden
                                ? "inset 0 0 0 1px #7c3aed"
                                : undefined,
                            }}
                            title={
                              draggable
                                ? cell.kind === "booking" && cell.isOverridden
                                  ? "Drag to move · Click to open · Night reassigned"
                                  : "Drag to move · Click to open"
                                : undefined
                            }
                          >
                            {booking.guest.split(" ")[0]}
                          </div>
                        </td>
                      );
                    }
                    const isDropAllowed =
                      drag !== null && drag.sourceDate === d;
                    return (
                      <td
                        key={d}
                        className={isToday ? "rc-today" : ""}
                        style={{
                          outline: isDropHover
                            ? "2px solid var(--acc)"
                            : undefined,
                          outlineOffset: isDropHover ? -2 : undefined,
                        }}
                        onDragOver={(e) => {
                          if (!isDropAllowed) return;
                          e.preventDefault();
                          setDropTarget({ roomId: room.id, date: d });
                        }}
                        onDragLeave={() => {
                          if (
                            dropTarget?.roomId === room.id &&
                            dropTarget?.date === d
                          ) {
                            setDropTarget(null);
                          }
                        }}
                        onDrop={(e) => {
                          if (!isDropAllowed) return;
                          e.preventDefault();
                          handleDrop(room.id, d);
                        }}
                      ></td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {hover?.kind === "booking" && (
        <BookingHoverCard booking={hover.booking} date={hover.date} rect={hover.rect} />
      )}
      {hover?.kind === "venue" && (
        <VenueHoverCard block={hover.block} venue={hover.venue} rect={hover.rect} />
      )}
      {hover?.kind === "bulk" && (
        <BulkHoverCard block={hover.block} rect={hover.rect} rooms={rooms} />
      )}

      {/* Unified block modal */}
      {unifiedModal.open && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeUnifiedModal(); }}>
          <div className="modal" style={{ maxWidth: 580, width: "100%" }}>
            <h3>
              {(unifiedModal.editingBulkId || unifiedModal.editingVenueId)
                ? uMode === "maintenance" ? "Edit Maintenance Block" : "Edit Block"
                : "New Block"}
            </h3>
            <p className="modal-desc">
              {uMode === "maintenance"
                ? "Take rooms or venues out of service — they cannot be assigned for the blocked dates."
                : "Block rooms, a venue, or both for a group in one step."}
            </p>

            {/* Mode selector — only when creating; an existing block keeps its kind */}
            {!unifiedModal.editingBulkId && !unifiedModal.editingVenueId && (
              <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="rc-block-mode"
                    checked={uMode === "book"}
                    onChange={() => setUMode("book")}
                  />
                  Book
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                  <input
                    type="radio"
                    name="rc-block-mode"
                    checked={uMode === "maintenance"}
                    onChange={() => setUMode("maintenance")}
                  />
                  Maintenance Block
                </label>
              </div>
            )}

            {uMode === "maintenance" ? (
              <>
                <div className="fg" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>Start Date *</label>
                    <input type="date" value={uCheckin} onChange={(e) => setUCheckin(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>End Date *</label>
                    <input type="date" value={uCheckout} min={uCheckin} onChange={(e) => setUCheckout(e.target.value)} />
                    <div className="field-hint">Blocked through the end date (inclusive)</div>
                  </div>
                  <div className="field" style={{ gridColumn: "span 2" }}>
                    <label>Reason</label>
                    <input
                      type="text"
                      value={mReason}
                      onChange={(e) => setMReason(e.target.value)}
                      placeholder="e.g. Painting, plumbing work"
                    />
                  </div>
                </div>

                {/* Rooms to block */}
                <div style={{ marginTop: 14, border: "1px solid var(--bd)", borderRadius: "var(--r2)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surf2)" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", flex: 1 }}>Rooms</span>
                    {mRoomRows.some((r) => r.roomIds.length > 0) && (
                      <span className="badge" style={{ background: "var(--grn-bg)", color: "var(--grn)" }}>
                        {mRoomRows.reduce((s, r) => s + r.roomIds.length, 0)} selected
                      </span>
                    )}
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setMRoomRows((p) => [...p, { catId: "", roomIds: [] }])}
                    >
                      + Add Row
                    </button>
                  </div>
                  <div style={{ padding: "12px 14px", borderTop: "1px solid var(--bd)" }}>
                    {mRoomRows.map((row, idx) => {
                      const catRooms = row.catId
                        ? roomInventory
                            .filter((r) => r.cat === row.catId && r.active)
                            .sort((a, b) => compareRoomLabels(a.label, b.label))
                        : [];
                      const free = row.catId ? maintFreeRooms[row.catId] : undefined;
                      return (
                        <div key={idx} style={{ marginBottom: idx === mRoomRows.length - 1 ? 0 : 12 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <select
                              value={row.catId}
                              style={{ flex: 1 }}
                              onChange={(e) =>
                                setMRoomRows((p) =>
                                  p.map((r, i) => (i === idx ? { catId: e.target.value, roomIds: [] } : r))
                                )
                              }
                            >
                              <option value="">— Room Category —</option>
                              {rooms.map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                            {mRoomRows.length > 1 && (
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: "var(--red)" }}
                                onClick={() => setMRoomRows((p) => p.filter((_, i) => i !== idx))}
                              >
                                ×
                              </button>
                            )}
                          </div>
                          {row.catId && (
                            !maintDatesValid ? (
                              <div className="field-hint" style={{ marginTop: 6 }}>Pick valid dates to see room numbers</div>
                            ) : catRooms.length === 0 ? (
                              <div className="field-hint" style={{ marginTop: 6 }}>No active rooms in this category</div>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                {catRooms.map((r) => {
                                  const selected = row.roomIds.includes(r.id);
                                  const disabled = !selected && !(free?.has(r.id) ?? false);
                                  return (
                                    <button
                                      key={r.id}
                                      type="button"
                                      disabled={disabled}
                                      title={disabled ? "Not available for the selected dates" : undefined}
                                      onClick={() =>
                                        setMRoomRows((p) =>
                                          p.map((rr, i) =>
                                            i === idx
                                              ? {
                                                  ...rr,
                                                  roomIds: selected
                                                    ? rr.roomIds.filter((id) => id !== r.id)
                                                    : [...rr.roomIds, r.id],
                                                }
                                              : rr
                                          )
                                        )
                                      }
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: "var(--r3)",
                                        border: selected ? "1px solid var(--acc)" : "1px solid var(--bd)",
                                        background: selected ? "var(--acc)" : "var(--surf)",
                                        color: selected ? "#fff" : "var(--t1)",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: disabled ? "not-allowed" : "pointer",
                                        opacity: disabled ? 0.45 : 1,
                                      }}
                                    >
                                      {r.label}
                                    </button>
                                  );
                                })}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Venues to block */}
                <div style={{ marginTop: 10, border: "1px solid var(--bd)", borderRadius: "var(--r2)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--surf2)" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", flex: 1 }}>Venues</span>
                    {mVenueRows.some((r) => r.venueIds.length > 0) && (
                      <span className="badge" style={{ background: "#ede9fe", color: "#5b21b6" }}>
                        {[...new Set(mVenueRows.flatMap((r) => r.venueIds))].length} selected
                      </span>
                    )}
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setMVenueRows((p) => [...p, { type: "", venueIds: [] }])}
                    >
                      + Add Row
                    </button>
                  </div>
                  <div style={{ padding: "12px 14px", borderTop: "1px solid var(--bd)" }}>
                    {mVenueRows.map((row, idx) => {
                      const typeVenues = row.type
                        ? venues.filter((v) => v.type === row.type && v.active)
                        : [];
                      return (
                        <div key={idx} style={{ marginBottom: idx === mVenueRows.length - 1 ? 0 : 12 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <select
                              value={row.type}
                              style={{ flex: 1 }}
                              onChange={(e) =>
                                setMVenueRows((p) =>
                                  p.map((r, i) => (i === idx ? { type: e.target.value, venueIds: [] } : r))
                                )
                              }
                            >
                              <option value="">— Venue Type —</option>
                              {allVenueTypes.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            {mVenueRows.length > 1 && (
                              <button
                                className="btn btn-ghost btn-xs"
                                style={{ color: "var(--red)" }}
                                onClick={() => setMVenueRows((p) => p.filter((_, i) => i !== idx))}
                              >
                                ×
                              </button>
                            )}
                          </div>
                          {row.type && (
                            !maintDatesValid ? (
                              <div className="field-hint" style={{ marginTop: 6 }}>Pick valid dates to see venues</div>
                            ) : typeVenues.length === 0 ? (
                              <div className="field-hint" style={{ marginTop: 6 }}>No active venues of this type</div>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                {typeVenues.map((v) => {
                                  const selected = row.venueIds.includes(v.id);
                                  const disabled = !selected && !maintVenueFree(v.id);
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      disabled={disabled}
                                      title={disabled ? "Already booked for the selected dates" : undefined}
                                      onClick={() =>
                                        setMVenueRows((p) =>
                                          p.map((rr, i) =>
                                            i === idx
                                              ? {
                                                  ...rr,
                                                  venueIds: selected
                                                    ? rr.venueIds.filter((id) => id !== v.id)
                                                    : [...rr.venueIds, v.id],
                                                }
                                              : rr
                                          )
                                        )
                                      }
                                      style={{
                                        padding: "4px 10px",
                                        borderRadius: "var(--r3)",
                                        border: selected ? "1px solid var(--acc)" : "1px solid var(--bd)",
                                        background: selected ? "var(--acc)" : "var(--surf)",
                                        color: selected ? "#fff" : "var(--t1)",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: disabled ? "not-allowed" : "pointer",
                                        opacity: disabled ? 0.45 : 1,
                                      }}
                                    >
                                      {v.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
            <>
            {/* Common fields */}
            <div className="fg" style={{ marginTop: 12 }}>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Group / Guest Name *</label>
                <input type="text" value={uName} onChange={(e) => setUName(e.target.value)} placeholder="e.g. Sharma Family" />
              </div>
              <div className="field">
                <label>Check-in *</label>
                <input type="date" value={uCheckin} onChange={(e) => setUCheckin(e.target.value)} />
              </div>
              <div className="field">
                <label>Check-out *</label>
                <input type="date" value={uCheckout} onChange={(e) => setUCheckout(e.target.value)} />
                <div className="field-hint">Same as check-in for a dayout (blocks that date)</div>
              </div>
              <div className="field">
                <label>Pax</label>
                <input type="number" value={uPax} min={0} onChange={(e) => setUPax(e.target.value)} placeholder="0" />
              </div>
              <div className="field">
                <label>Amount (₹)</label>
                <input type="number" value={uAmount} min={0} onChange={(e) => setUAmount(e.target.value)} placeholder="0" />
              </div>
            </div>

            {/* Bulk Rooms accordion */}
            <div style={{ marginTop: 14, border: "1px solid var(--bd)", borderRadius: "var(--r2)", overflow: "hidden" }}>
              <button
                type="button"
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", background: uBulkOpen ? "var(--surf2)" : "var(--surf)",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}
                onClick={() => setUBulkOpen((v) => !v)}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", flex: 1 }}>Bulk Rooms</span>
                {uBulkOpen && uCatRows.some((r) => r.catId) && (
                  <span className="badge" style={{ background: "var(--grn-bg)", color: "var(--grn)" }}>
                    {uCatRows.filter((r) => r.catId).length} {uCatRows.filter((r) => r.catId).length === 1 ? "category" : "categories"}
                  </span>
                )}
                <span style={{ fontSize: 16, color: "var(--t3)", display: "inline-block", transform: uBulkOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>&#8964;</span>
              </button>

              {uBulkOpen && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid var(--bd)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--t3)" }}>Select room categories and quantity to block</span>
                    <button className="btn btn-ghost btn-xs" style={{ marginLeft: "auto" }} onClick={() => setUCatRows((p) => [...p, { catId: "", count: 1 }])}>
                      + Add Row
                    </button>
                  </div>
                  <table className="pricing-tbl">
                    <thead>
                      <tr>
                        <th>Room Category</th>
                        <th style={{ width: 110, textAlign: "center" }}>Available</th>
                        <th style={{ width: 110, textAlign: "center" }}>Rooms Needed</th>
                        <th style={{ width: 50 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {uCatRows.map((row, idx) => {
                        const avail = row.catId ? (bulkAvailability[row.catId] ?? 0) : null;
                        return (
                          <tr key={idx}>
                            <td>
                              <select value={row.catId} onChange={(e) => setUCatRows((p) => p.map((r, i) => i === idx ? { ...r, catId: e.target.value } : r))}>
                                <option value="">— Category —</option>
                                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </td>
                            <td style={{ textAlign: "center", fontSize: 13 }}>
                              {avail === null ? "—" : (
                                <span style={{ color: avail === 0 ? "var(--red)" : avail <= 2 ? "var(--amb)" : "var(--grn)", fontWeight: 600 }}>
                                  {avail}
                                </span>
                              )}
                            </td>
                            <td>
                              <input type="number" value={row.count} min={1} max={avail ?? 99} style={{ textAlign: "center" }}
                                onChange={(e) => setUCatRows((p) => p.map((r, i) => i === idx ? { ...r, count: parseInt(e.target.value) || 1 } : r))} />
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {uCatRows.length > 1 && (
                                <button className="btn btn-ghost btn-xs" style={{ color: "var(--red)" }} onClick={() => setUCatRows((p) => p.filter((_, i) => i !== idx))}>×</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Venue accordion */}
            <div style={{ marginTop: 10, border: "1px solid var(--bd)", borderRadius: "var(--r2)", overflow: "hidden" }}>
              <button
                type="button"
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", background: uVenueOpen ? "var(--surf2)" : "var(--surf)",
                  border: "none", cursor: "pointer", textAlign: "left",
                }}
                onClick={() => {
                  if (!uVenueOpen && venues.filter((v) => v.active).length === 0) {
                    showNotif("No venues defined. Add venues in Master Setup first.", "error");
                    return;
                  }
                  setUVenueOpen((v) => !v);
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", flex: 1 }}>Venue</span>
                {uVenueOpen && uVenueIds.some(Boolean) && (
                  <span className="badge" style={{ background: "#ede9fe", color: "#5b21b6" }}>
                    {uVenueIds.filter(Boolean).length === 1
                      ? venueById[uVenueIds.find(Boolean)!]?.name || "Selected"
                      : `${uVenueIds.filter(Boolean).length} venues`}
                  </span>
                )}
                <span style={{ fontSize: 16, color: "var(--t3)", display: "inline-block", transform: uVenueOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>&#8964;</span>
              </button>

              {uVenueOpen && (
                <div style={{ padding: "12px 14px", borderTop: "1px solid var(--bd)" }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--t3)" }}>Select venues to book</span>
                    <button
                      className="btn btn-ghost btn-xs"
                      style={{ marginLeft: "auto" }}
                      onClick={() => setUVenueIds((p) => [...p, ""])}
                    >
                      + Add Row
                    </button>
                  </div>
                  {uVenueIds.map((vid, idx) => (
                    <div
                      key={idx}
                      style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: idx === uVenueIds.length - 1 ? 0 : 8 }}
                    >
                      <select
                        value={vid}
                        style={{ flex: 1 }}
                        onChange={(e) => setUVenueIds((p) => p.map((v, i) => (i === idx ? e.target.value : v)))}
                      >
                        <option value="">— Select venue —</option>
                        {allVenueTypes.map((type) => {
                          const items = venues.filter((v) => v.type === type && v.active);
                          if (items.length === 0) return null;
                          return (
                            <optgroup key={type} label={type}>
                              {items.map((v) => (
                                <option key={v.id} value={v.id} disabled={v.id !== vid && uVenueIds.includes(v.id)}>
                                  {v.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                      {uVenueIds.length > 1 && (
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: "var(--red)" }}
                          onClick={() => setUVenueIds((p) => p.filter((_, i) => i !== idx))}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            )}

            <div className="modal-actions" style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
              <div>
                {(unifiedModal.editingBulkId || unifiedModal.editingVenueId) && (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      if (unifiedModal.editingBulkId) removeBulkRoomBlock(unifiedModal.editingBulkId);
                      if (unifiedModal.editingVenueId) removeVenueBlock(unifiedModal.editingVenueId);
                      showNotif("Block removed", "success");
                      closeUnifiedModal();
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={closeUnifiedModal}>Cancel</button>
                {uMode === "maintenance" ? (
                  <button className="btn btn-primary" onClick={saveMaintenance}>
                    {(unifiedModal.editingBulkId || unifiedModal.editingVenueId) ? "Save Changes" : "Block for Maintenance"}
                  </button>
                ) : (
                  <>
                    <button className="btn btn-ghost" onClick={() => saveUnified("Tentative")}>Tentatively Book</button>
                    <button className="btn btn-primary" onClick={() => saveUnified("Confirmed")}>Confirm Book</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk block detail modal */}
      {bulkDetail && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setBulkDetail(null); }}>
          <div className="modal modal-sm">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: 2 }}>
                  {bulkDetail.status === "Maintenance" ? "Maintenance Block" : bulkDetail.label}
                </h3>
                <div style={{ fontSize: 13, color: "var(--t3)" }}>
                  {bulkDetail.status === "Maintenance" ? (bulkDetail.reason || "No reason given") : bulkDetail.guestName}
                </div>
              </div>
              <span
                className="badge"
                style={
                  bulkDetail.status === "Maintenance"
                    ? { background: "var(--bd)", color: "var(--t2)" }
                    : { background: bulkDetail.status === "Tentative" ? "var(--amb-bg)" : "var(--grn-bg)", color: bulkDetail.status === "Tentative" ? "var(--amb)" : "var(--grn)" }
                }
              >
                {bulkDetail.status}
              </span>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "var(--t2)" }}>
              <div>
                {bulkDetail.status === "Maintenance"
                  ? (() => {
                      const endIncl = addDays(bulkDetail.checkout, -1);
                      return bulkDetail.checkin === endIncl
                        ? fmtIN(bulkDetail.checkin)
                        : `${fmtIN(bulkDetail.checkin)} → ${fmtIN(endIncl)}`;
                    })()
                  : bulkDetail.checkin === bulkDetail.checkout
                  ? `${fmtIN(bulkDetail.checkin)} · Dayout (same-day)`
                  : `${fmtIN(bulkDetail.checkin)} → ${fmtIN(bulkDetail.checkout)}`}
              </div>
              {bulkDetail.pax > 0 && <div style={{ marginTop: 4 }}>{bulkDetail.pax} pax</div>}
              {bulkDetail.amount > 0 && <div style={{ marginTop: 4 }}>{fmt(bulkDetail.amount)}</div>}
            </div>
            <div style={{ marginTop: 10 }}>
              {bulkDetail.rows.map((row) => (
                <div key={row.catId} style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>
                  {rooms.find((r) => r.id === row.catId)?.name ?? row.catName}: {[...row.roomIds].sort(compareRoomLabels).join(", ")} ({row.roomIds.length} room{row.roomIds.length !== 1 ? "s" : ""})
                </div>
              ))}
            </div>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                className="btn btn-ghost"
                style={{ color: "var(--red)" }}
                onClick={() => { removeBulkRoomBlock(bulkDetail.id); showNotif("Block removed", "success"); setBulkDetail(null); }}
              >
                Delete
              </button>
              {bulkDetail.status === "Tentative" && (
                <button
                  className="btn btn-ghost"
                  onClick={() => { updateBulkRoomBlock(bulkDetail.id, { status: "Confirmed" }); showNotif("Block confirmed", "success"); setBulkDetail(null); }}
                >
                  Confirm
                </button>
              )}
              <button className="btn btn-primary" onClick={() => openBulkEdit(bulkDetail)}>
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingUpgrade && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingUpgrade(null);
          }}
        >
          <div className="modal modal-sm">
            <h3>Room Upgrade</h3>
            <p className="modal-desc">
              You are moving this booking from{" "}
              <strong>{pendingUpgrade.fromCategoryName}</strong> to{" "}
              <strong>{pendingUpgrade.toCategoryName}</strong>. Is it
              complimentary or chargeable?
            </p>
            <div
              style={{
                display: "flex",
                gap: 14,
                marginBottom: 14,
                marginTop: 6,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <input
                  type="radio"
                  name="upkind"
                  checked={upKind === "complimentary"}
                  onChange={() => setUpKind("complimentary")}
                />
                Complimentary
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <input
                  type="radio"
                  name="upkind"
                  checked={upKind === "paid"}
                  onChange={() => setUpKind("paid")}
                />
                Extra Charge
              </label>
            </div>

            {upKind === "paid" && (
              <div className="field">
                <label>Upgrade Charge (₹) *</label>
                <input
                  type="number"
                  value={upAmount}
                  onChange={(e) => setUpAmount(e.target.value)}
                  min={1}
                  placeholder="0"
                  autoFocus
                />
                <div className="field-hint">
                  Added to the booking total and shows up in Revenue.
                </div>
              </div>
            )}

            <div
              className="modal-actions"
              style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                className="btn btn-ghost"
                onClick={() => setPendingUpgrade(null)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmUpgrade}>
                Confirm Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function positionForCard(rect: DOMRect, cardW: number) {
  let left = rect.left + rect.width / 2;
  const minL = 8 + cardW / 2;
  const maxL = window.innerWidth - 8 - cardW / 2;
  if (left < minL) left = minL;
  if (left > maxL) left = maxL;
  let top = rect.top - 10;
  let placeAbove = true;
  if (top < 200) {
    top = rect.bottom + 10;
    placeAbove = false;
  }
  return { top, left, placeAbove };
}

function BookingHoverCard({
  booking,
  date,
  rect,
}: {
  booking: Booking;
  date: string;
  rect: DOMRect;
}) {
  // Counts for the hovered night's segment; booking-level fallback for
  // legacy bookings without per-segment data.
  const seg = booking.segments?.find((s) => s.checkin <= date && date < s.checkout);
  const adults = seg?.adults ?? booking.adults ?? 0;
  const seniors = seg?.seniors ?? booking.seniors ?? 0;
  const pets = seg?.pets ?? booking.pets ?? 0;
  const mealOn = seg?.mealOn ?? booking.mealOn;
  const kids = seg
    ? (seg.kidsAbove10 || 0) + (seg.kids6to10 || 0) + (seg.kids2to6 || 0) + (seg.infantsBelow2 || 0)
    : (booking.kidsAbove10 || 0) +
      (booking.kids6to10 || 0) +
      (booking.kids2to6 || 0) +
      (booking.infantsBelow2 || 0);
  const pax = adults + kids + seniors;

  const cardW = 260;
  const { top, left, placeAbove } = positionForCard(rect, cardW);

  const statusColor =
    booking.status === "Confirmed"
      ? "var(--grn)"
      : booking.status === "Tentative"
      ? "var(--amb)"
      : "var(--yel)";
  const statusBg =
    booking.status === "Confirmed"
      ? "var(--grn-bg)"
      : booking.status === "Tentative"
      ? "var(--amb-bg)"
      : "var(--yel-bg)";

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        transform: placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        width: cardW,
        background: "var(--surf)",
        border: "1px solid var(--bd)",
        borderRadius: "var(--r2)",
        boxShadow: "0 6px 22px rgba(0,0,0,.14)",
        padding: "12px 14px",
        fontSize: 12,
        color: "var(--t1)",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--t1)" }}>
          {booking.guest}
        </div>
        <span
          className="badge"
          style={{ background: statusBg, color: statusColor, fontSize: 10 }}
        >
          {booking.status}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>
        {booking.id} · {fmtIN(booking.checkin)} to {fmtIN(booking.checkout)} ·{" "}
        {booking.nights} {booking.nights === 1 ? "night" : "nights"}
      </div>

      <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 4, fontWeight: 600 }}>
        Guests on {fmtIN(date)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <HoverRow label="Pax" value={String(pax)} />
        <HoverRow label="Adults" value={String(adults)} />
        <HoverRow label="Kids" value={String(kids)} />
        <HoverRow label="Sr. Citizens" value={String(seniors)} />
        {pets > 0 && (
          <HoverRow label="Pets" value={String(pets)} />
        )}
        <HoverRow
          label="Meal Pkg"
          value={mealOn ? "Yes" : "No"}
          highlight={mealOn ? "var(--grn)" : undefined}
        />
      </div>

      {booking.balance > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: "6px 8px",
            background: "var(--amb-lt)",
            borderRadius: "var(--r3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 600 }}>
            Amount Due
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--amb)" }}>
            {fmt(booking.balance)}
          </span>
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: "var(--t3)",
          textAlign: "right",
        }}
      >
        Click to open booking
      </div>
    </div>
  );
}

function VenueHoverCard({
  block,
  venue,
  rect,
}: {
  block: VenueBlock;
  venue: Venue;
  rect: DOMRect;
}) {
  const cardW = 260;
  const { top, left, placeAbove } = positionForCard(rect, cardW);
  const nights = nightsBetween(block.checkin, block.checkout);
  const isMaint = block.status === "Maintenance";
  const maintEnd = addDays(block.checkout, -1);

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        transform: placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        width: cardW,
        background: "var(--surf)",
        border: "1px solid var(--bd)",
        borderRadius: "var(--r2)",
        boxShadow: "0 6px 22px rgba(0,0,0,.14)",
        padding: "12px 14px",
        fontSize: 12,
        color: "var(--t1)",
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--t1)" }}>
          {isMaint ? "Maintenance" : block.name}
        </div>
        <span
          className="badge"
          style={
            isMaint
              ? { background: "var(--bd)", color: "var(--t2)", fontSize: 10 }
              : { background: "#ede9fe", color: "#5b21b6", fontSize: 10 }
          }
        >
          {isMaint ? "Maintenance" : "Venue"}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>
        {venue.name} · {venue.type}
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>
        {isMaint
          ? block.checkin === maintEnd
            ? fmtIN(block.checkin)
            : `${fmtIN(block.checkin)} to ${fmtIN(maintEnd)}`
          : nights === 0
          ? `${fmtIN(block.checkin)} · Dayout (same-day)`
          : `${fmtIN(block.checkin)} to ${fmtIN(block.checkout)} · ${nights} ${nights === 1 ? "night" : "nights"}`}
      </div>

      {isMaint ? (
        <div style={{ fontSize: 11, color: "var(--t2)" }}>
          {block.reason || "No reason given"}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <HoverRow label="Pax" value={String(block.pax || 0)} />
          <HoverRow
            label="Amount"
            value={block.amount > 0 ? fmt(block.amount) : "—"}
          />
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          fontSize: 10,
          color: "var(--t3)",
          textAlign: "right",
        }}
      >
        Click to edit or delete
      </div>
    </div>
  );
}

function BulkHoverCard({ block, rect, rooms }: { block: BulkRoomBlock; rect: DOMRect; rooms: RoomMaster[] }) {
  const cardW = 260;
  const { top, left, placeAbove } = positionForCard(rect, cardW);
  const isMaint = block.status === "Maintenance";
  const nights = nightsBetween(block.checkin, block.checkout);
  const totalRooms = block.rows.reduce((s, r) => s + r.roomIds.length, 0);
  const maintEnd = addDays(block.checkout, -1);
  return (
    <div
      style={{
        position: "fixed", top, left,
        transform: placeAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        width: cardW,
        background: "var(--surf)", border: "1px solid var(--bd)",
        borderRadius: "var(--r2)", boxShadow: "0 6px 22px rgba(0,0,0,.14)",
        padding: "12px 14px", fontSize: 12, color: "var(--t1)", zIndex: 60, pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{isMaint ? "Maintenance" : block.label}</div>
        <span
          className="badge"
          style={
            isMaint
              ? { background: "var(--bd)", color: "var(--t2)", fontSize: 10 }
              : { background: block.status === "Tentative" ? "var(--amb-bg)" : "var(--grn-bg)", color: block.status === "Tentative" ? "var(--amb)" : "var(--grn)", fontSize: 10 }
          }
        >
          {block.status}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>
        {isMaint ? (block.reason || "No reason given") : block.guestName}
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>
        {isMaint
          ? block.checkin === maintEnd
            ? fmtIN(block.checkin)
            : `${fmtIN(block.checkin)} to ${fmtIN(maintEnd)}`
          : nights === 0
          ? `${fmtIN(block.checkin)} · Dayout (same-day)`
          : `${fmtIN(block.checkin)} to ${fmtIN(block.checkout)} · ${nights} ${nights === 1 ? "night" : "nights"}`}
      </div>
      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>
        {totalRooms} room{totalRooms !== 1 ? "s" : ""} · {block.rows.map((r) => `${r.roomIds.length} ${rooms.find((rm) => rm.id === r.catId)?.name ?? r.catName}`).join(", ")}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "var(--t3)", textAlign: "right" }}>Click to view / edit / delete</div>
    </div>
  );
}

function HoverRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 11,
        padding: "2px 0",
      }}
    >
      <span style={{ color: "var(--t3)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: highlight || "var(--t1)" }}>
        {value}
      </span>
    </div>
  );
}
