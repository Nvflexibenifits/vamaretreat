"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Booking,
  BookingSegment,
  BookingStatus,
  BulkRoomBlock,
  CancellationDetails,
  CancellationPolicy,
  CreditNote,
  CreditNoteSettings,
  DiscountCaps,
  Extra,
  GstSettings,
  NotifKind,
  PackageRates,
  RevenueEntry,
  Role,
  RoomInventoryItem,
  RoomMaster,
  RoomNightUpgrade,
  SpecialDay,
  Venue,
  VenueBlock,
} from "@/types";
import {
  ROOMS as SEED_ROOMS,
  SEED_CANCELLATION_POLICY,
  SEED_CREDIT_NOTE_SETTINGS,
  SEED_DISCOUNT_CAPS,
  SEED_GST_SETTINGS,
  SEED_PACKAGE_RATES,
  SEED_ROOM_INVENTORY,
  SEED_SPECIAL_DAYS,
  SEED_VENUES,
  SEED_VENUE_TYPES,
  SEED_VENUE_BLOCKS,
  SEED_BULK_ROOM_BLOCKS,
} from "@/lib/data";
import { addDays, nowTime, todayStr } from "@/lib/utils";

type ModalKind = "lost" | "payment" | "complete" | "crm-note" | null;

type ModalState = {
  kind: ModalKind;
  bookingId?: string | null;
  crmKey?: { mobile: string; name: string };
};

type AppContextValue = {
  // auth
  isAuthed: boolean;
  sessionChecking: boolean;
  currentRole: Role;
  currentUser: string;
  login: (role: Role, user: string) => void;
  logout: () => void;
  // bookings
  bookings: Booking[];
  hydrated: boolean;
  revenueEntries: RevenueEntry[];
  guestNotes: Record<string, string>;
  setGuestNote: (mobile: string, note: string) => void;
  createBooking: (b: Booking) => void;
  updateBooking: (bookingId: string, patch: Partial<Booking>) => void;
  addExtras: (bookingId: string, extras: Extra[]) => void;
  markLost: (bookingId: string, reason: string, notes: string) => void;
  recordPayment: (
    bookingId: string,
    amount: number,
    mode: string,
    type: string,
    creditNoteCode?: string
  ) => void;
  redeemCreditNote: (
    code: string,
    bookingId: string,
    amount: number
  ) => { ok: true; note: CreditNote } | { ok: false; error: string };
  completeBooking: (
    bookingId: string,
    extras: Extra[],
    extraNights: number
  ) => void;
  setAllocatedRooms: (bookingId: string, rooms: string[]) => void;
  applyNightOverride: (
    bookingId: string,
    opts: {
      date: string;
      fromRoomId: string;
      toRoomId: string;
      upgrade?: RoomNightUpgrade;
    }
  ) => void;
  clearNightOverride: (
    bookingId: string,
    date: string,
    fromRoomId: string
  ) => void;
  // master setup
  rooms: RoomMaster[];
  roomInventory: RoomInventoryItem[];
  discountCaps: DiscountCaps;
  packageRates: PackageRates;
  specialDays: SpecialDay[];
  creditNoteSettings: CreditNoteSettings;
  gstSettings: GstSettings;
  cancellationPolicy: CancellationPolicy;
  venues: Venue[];
  venueTypes: string[];
  updateVenueTypes: (types: string[]) => void;
  userRoles: string[];
  updateUserRoles: (roles: string[]) => void;
  venueBlocks: VenueBlock[];
  updateRooms: (rooms: RoomMaster[]) => void;
  addRoomInventoryItem: (item: RoomInventoryItem) => void;
  updateRoomInventoryItem: (id: string, patch: Partial<RoomInventoryItem>) => void;
  removeRoomInventoryItem: (id: string) => void;
  updateDiscountCaps: (caps: DiscountCaps) => void;
  updatePackageRates: (rates: PackageRates) => void;
  addSpecialDay: (sd: SpecialDay) => void;
  removeSpecialDay: (id: string) => void;
  creditNotes: CreditNote[];
  cancelBooking: (bookingId: string, details: CancellationDetails) => void;
  updateCreditNoteSettings: (s: CreditNoteSettings) => void;
  updateGstSettings: (s: GstSettings) => void;
  updateCancellationPolicy: (p: CancellationPolicy) => void;
  addVenue: (v: Venue) => void;
  updateVenue: (id: string, patch: Partial<Venue>) => void;
  removeVenue: (id: string) => void;
  addVenueBlock: (vb: VenueBlock) => void;
  updateVenueBlock: (id: string, patch: Partial<VenueBlock>) => void;
  removeVenueBlock: (id: string) => void;
  bulkRoomBlocks: BulkRoomBlock[];
  addBulkRoomBlock: (b: BulkRoomBlock) => void;
  updateBulkRoomBlock: (id: string, patch: Partial<BulkRoomBlock>) => void;
  removeBulkRoomBlock: (id: string) => void;
  // notification
  notif: { msg: string; kind: NotifKind } | null;
  showNotif: (msg: string, kind?: NotifKind) => void;
  // modal
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

// Defensive: persisted bookings from older schemas may be missing fields like
// allocatedRooms or extras. Normalize so all downstream code can rely on them.
function normalizeBooking(b: Partial<Booking>): Booking {
  return {
    ...(b as Booking),
    allocatedRooms: Array.isArray(b.allocatedRooms) ? b.allocatedRooms : [],
    payments: Array.isArray(b.payments) ? b.payments : [],
    extras: Array.isArray(b.extras) ? b.extras : [],
    segments: Array.isArray(b.segments) ? b.segments.map((seg: BookingSegment) => ({
      ...seg,
      adults: seg.adults ?? b.adults ?? 2,
      seniors: seg.seniors ?? b.seniors ?? 0,
      kidsAbove10: seg.kidsAbove10 ?? b.kidsAbove10 ?? 0,
      kids6to10: seg.kids6to10 ?? b.kids6to10 ?? 0,
      kids2to6: seg.kids2to6 ?? b.kids2to6 ?? 0,
      infantsBelow2: seg.infantsBelow2 ?? b.infantsBelow2 ?? 0,
      pets: seg.pets ?? b.pets ?? 0,
      mealOn: seg.mealOn ?? b.mealOn ?? false,
      drivers: seg.drivers ?? b.driverCount ?? 0,
      driverMealOn: seg.driverMealOn ?? b.driverMealOn ?? false,
      mealTotal: seg.mealTotal ?? 0,
      mealGst: seg.mealGst ?? 0,
      mealWithGst: seg.mealWithGst ?? 0,
    })) : [],
    driverCount: b.driverCount ?? 0,
    driverTotal: b.driverTotal ?? 0,
    driverGst: b.driverGst ?? 0,
    driverMealOn: b.driverMealOn ?? false,
    driverMealTotal: b.driverMealTotal ?? 0,
    driverMealGst: b.driverMealGst ?? 0,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [currentRole, setCurrentRole] = useState<Role>("Sales");
  const [currentUser, setCurrentUser] = useState<string>("Sales User");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guestNotes, setGuestNotes] = useState<Record<string, string>>({});
  const [rooms, setRooms] = useState<RoomMaster[]>(SEED_ROOMS);
  const [roomInventory, setRoomInventory] = useState<RoomInventoryItem[]>(SEED_ROOM_INVENTORY);
  const [discountCaps, setDiscountCapsState] =
    useState<DiscountCaps>(SEED_DISCOUNT_CAPS);
  const [packageRates, setPackageRatesState] =
    useState<PackageRates>(SEED_PACKAGE_RATES);
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>(SEED_SPECIAL_DAYS);
  const [creditNoteSettings, setCreditNoteSettings] =
    useState<CreditNoteSettings>(SEED_CREDIT_NOTE_SETTINGS);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [gstSettings, setGstSettings] =
    useState<GstSettings>(SEED_GST_SETTINGS);
  const [cancellationPolicy, setCancellationPolicy] =
    useState<CancellationPolicy>(SEED_CANCELLATION_POLICY);
  const [venues, setVenues] = useState<Venue[]>(SEED_VENUES);
  const [venueTypes, setVenueTypesState] = useState<string[]>(SEED_VENUE_TYPES);
  const [userRoles, setUserRolesState] = useState<string[]>(["Admin", "Front Office", "Sales"]);
  const [venueBlocks, setVenueBlocks] = useState<VenueBlock[]>(SEED_VENUE_BLOCKS);
  const [bulkRoomBlocks, setBulkRoomBlocks] = useState<BulkRoomBlock[]>(SEED_BULK_ROOM_BLOCKS);
  const [hydrated, setHydrated] = useState(false);

  const [notif, setNotif] = useState<{ msg: string; kind: NotifKind } | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: null });

  // Restore session from HTTP-only cookie via /api/auth/me on mount.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentRole(data.user.role as Role);
          setCurrentUser(data.user.name);
          setIsAuthed(true);
        }
      })
      .catch(() => {})
      .finally(() => setSessionChecking(false));
  }, []);

  // Timestamp of the last local mutation. Server refreshes are skipped for a
  // short window afterwards so a fire-and-forget write isn't clobbered by a
  // refetch that raced ahead of it.
  const lastMutationRef = useRef(0);

  // Server payload is dynamic JSON; fields are validated before use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyServerState = useCallback((data: any) => {
    if (Array.isArray(data.bookings))
      setBookings((data.bookings as Partial<Booking>[]).map(normalizeBooking));
    if (Array.isArray(data.rooms) && data.rooms.length > 0) setRooms(data.rooms);
    if (Array.isArray(data.roomInventory) && data.roomInventory.length > 0) setRoomInventory(data.roomInventory);
    if (Array.isArray(data.venues)) setVenues(data.venues);
    if (Array.isArray(data.venueTypes)) setVenueTypesState(data.venueTypes);
    if (Array.isArray(data.userRoles)) setUserRolesState(data.userRoles);
    if (Array.isArray(data.venueBlocks)) setVenueBlocks(data.venueBlocks);
    if (Array.isArray(data.bulkRoomBlocks)) setBulkRoomBlocks(data.bulkRoomBlocks);
    if (Array.isArray(data.specialDays)) setSpecialDays(data.specialDays);
    if (Array.isArray(data.creditNotes)) setCreditNotes(data.creditNotes);
    if (data.guestNotes && typeof data.guestNotes === "object") setGuestNotes(data.guestNotes);
    if (data.gstSettings) setGstSettings(data.gstSettings);
    if (data.cancellationPolicy && "standardThreshold" in data.cancellationPolicy) setCancellationPolicy(data.cancellationPolicy);
    if (data.packageRates) setPackageRatesState({ ...SEED_PACKAGE_RATES, ...data.packageRates });
    if (data.discountCaps) setDiscountCapsState({ sales: (data.discountCaps.sales as number) ?? SEED_DISCOUNT_CAPS.sales, admin: (data.discountCaps.admin as number | null) ?? SEED_DISCOUNT_CAPS.admin });
    if (data.creditNoteSettings) setCreditNoteSettings(data.creditNoteSettings);
  }, []);

  // Hydrate from Neon DB via API on mount.
  useEffect(() => {
    fetch("/api/app/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) applyServerState(data);
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
  }, [applyServerState]);

  // Live refresh: re-pull server state on window focus and every 30s so
  // master-setup and booking changes made in other tabs, devices, or sessions
  // show up without a manual reload.
  useEffect(() => {
    if (!hydrated || !isAuthed) return;
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastMutationRef.current < 5000) return;
      fetch("/api/app/state")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || cancelled) return;
          if (Date.now() - lastMutationRef.current < 5000) return;
          applyServerState(data);
        })
        .catch(() => {});
    };
    const iv = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [hydrated, isAuthed, applyServerState]);

  // Auto-mark stale Enquiry/Tentative bookings as Lost when checkin date has passed
  useEffect(() => {
    if (!hydrated) return;
    const today = todayStr();
    setBookings((prev) => {
      const stale = prev.filter(
        (b) => (b.status === "Enquiry" || b.status === "Tentative") && b.checkin < today
      );
      if (stale.length === 0) return prev;
      lastMutationRef.current = Date.now();
      stale.forEach((b) => {
        fetch(`/api/app/bookings/${b.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Lost", lostReason: "Check-in date passed" }),
        }).catch(console.error);
      });
      return prev.map((b) =>
        (b.status === "Enquiry" || b.status === "Tentative") && b.checkin < today
          ? { ...b, status: "Lost" as const, lostReason: "Check-in date passed" }
          : b
      );
    });
  }, [hydrated]);

  // Notification auto-dismiss
  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(() => setNotif(null), 3000);
    return () => clearTimeout(t);
  }, [notif]);

  // Fire-and-forget sync helper for mutations with a body. Failures are
  // surfaced as a notification — a silent failure looks saved locally but
  // vanishes on the next reload.
  const sync = (url: string, method: string, body: unknown) => {
    lastMutationRef.current = Date.now();
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (!r.ok) {
          const detail = await r.json().then((d) => d?.error).catch(() => null);
          console.error(`[sync] ${method} ${url} failed: ${r.status}`, detail);
          setNotif({
            msg: detail || "Warning: last change could not be saved to the server",
            kind: "error",
          });
        }
      })
      .catch(() => {
        setNotif({ msg: "Network error: last change was not saved", kind: "error" });
      });
  };

  // Fire-and-forget DELETE helper.
  const del = (url: string) => {
    lastMutationRef.current = Date.now();
    fetch(url, { method: "DELETE" })
      .then((r) => {
        if (!r.ok) {
          console.error(`[del] DELETE ${url} failed: ${r.status}`);
          setNotif({
            msg: "Warning: last delete could not be saved to the server",
            kind: "error",
          });
        }
      })
      .catch(() => {
        setNotif({ msg: "Network error: last delete was not saved", kind: "error" });
      });
  };

  const showNotif = useCallback((msg: string, kind: NotifKind = "success") => {
    setNotif({ msg, kind });
  }, []);

  const login = useCallback((role: Role, user: string) => {
    setCurrentRole(role);
    setCurrentUser(user);
    setIsAuthed(true);
  }, []);

  const logout = useCallback(() => {
    setIsAuthed(false);
  }, []);

  const openModal = useCallback((m: ModalState) => setModal(m), []);
  const closeModalCb = useCallback(() => setModal({ kind: null }), []);

  const setGuestNote = useCallback((mobile: string, note: string) => {
    setGuestNotes((prev) => {
      const next = { ...prev, [mobile]: note };
      sync("/api/app/settings", "PUT", { guestNotes: next });
      return next;
    });
  }, []);

  const createBooking = useCallback((b: Booking) => {
    setBookings((prev) => [b, ...prev]);
    sync("/api/app/bookings", "POST", b);
  }, []);

  const updateBooking = useCallback((bookingId: string, patch: Partial<Booking>) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, ...patch } : b))
    );
    sync(`/api/app/bookings/${bookingId}`, "PATCH", patch);
  }, []);

  const cancelBooking = useCallback(
    (bookingId: string, details: CancellationDetails) => {
      let guestName = "";
      let guestMobile = "";
      setBookings((prev) => {
        const found = prev.find((b) => b.id === bookingId);
        if (found) { guestName = found.guest; guestMobile = found.mobile; }
        return prev.map((b) =>
          b.id !== bookingId
            ? b
            : { ...b, status: "Cancelled" as BookingStatus, cancellationDetails: details }
        );
      });
      sync(`/api/app/bookings/${bookingId}`, "PATCH", { status: "Cancelled", cancellationDetails: details });
      if (details.creditNoteAmount > 0 && details.creditNoteCode) {
        const cn: CreditNote = {
          code: details.creditNoteCode,
          guestName,
          guestMobile,
          originalBookingId: bookingId,
          cancellationDate: details.cancellationDate,
          totalAmount: details.creditNoteAmount,
          usedAmount: 0,
          remainingAmount: details.creditNoteAmount,
          status: "Available",
          transactions: [],
        };
        setCreditNotes((prev) => [...prev, cn]);
        sync("/api/app/credit-notes", "POST", cn);
        setCreditNoteSettings((prev) => {
          const next = { ...prev, nextNumber: prev.nextNumber + 1 };
          sync("/api/app/settings", "PUT", { creditNoteSettings: next });
          return next;
        });
      }
    },
    []
  );

  // Redeem part (or all) of a credit note against a booking. Validates the
  // code and remaining balance, records the transaction, and persists.
  const redeemCreditNote = useCallback(
    (code: string, bookingId: string, amount: number): { ok: true; note: CreditNote } | { ok: false; error: string } => {
      const cn = creditNotes.find((c) => c.code.trim().toLowerCase() === code.trim().toLowerCase());
      if (!cn) return { ok: false, error: `Credit note ${code.trim()} not found` };
      if (amount <= 0) return { ok: false, error: "Enter a valid credit note amount" };
      if (cn.remainingAmount < amount) {
        return {
          ok: false,
          error: `${cn.code} has only ₹${cn.remainingAmount.toLocaleString("en-IN")} remaining`,
        };
      }
      const remainingAfter = cn.remainingAmount - amount;
      const updated: CreditNote = {
        ...cn,
        usedAmount: cn.usedAmount + amount,
        remainingAmount: remainingAfter,
        status: remainingAfter <= 0 ? "Fully Used" : "Partially Used",
        transactions: [
          ...(cn.transactions ?? []),
          { date: todayStr(), bookingId, amountUsed: amount, remainingAfter },
        ],
      };
      setCreditNotes((prev) => prev.map((c) => (c.code === cn.code ? updated : c)));
      sync(`/api/app/credit-notes/${encodeURIComponent(cn.code)}`, "PATCH", updated);
      return { ok: true, note: updated };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [creditNotes]
  );

  const addExtras = useCallback((bookingId: string, newExtras: Extra[]) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== bookingId) return b;
        const charge = newExtras.reduce((s, e) => s + (e.amount || 0) + (e.gst || 0), 0);
        const paid = newExtras.reduce((s, e) => s + (e.totalPaid ?? ((e.amount || 0) + (e.gst || 0))), 0);
        const grandTotal = b.grandTotal + charge;
        const advance = b.advance + paid;
        const balance = Math.max(0, grandTotal - advance);
        const updatedExtras = [...b.extras, ...newExtras];
        sync(`/api/app/bookings/${bookingId}`, "PATCH", { extras: updatedExtras, grandTotal, advance, balance });
        return { ...b, extras: updatedExtras, grandTotal, advance, balance };
      })
    );
  }, []);

  // ─── Master setup setters ───
  const updateRooms = useCallback((next: RoomMaster[]) => {
    setRooms(next);
    sync("/api/app/rooms", "PUT", next);
  }, []);

  const addRoomInventoryItem = useCallback((item: RoomInventoryItem) => {
    setRoomInventory((prev) => [...prev, item]);
    sync("/api/app/room-inventory", "POST", item);
  }, []);

  const updateRoomInventoryItem = useCallback(
    (id: string, patch: Partial<RoomInventoryItem>) => {
      setRoomInventory((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
      sync(`/api/app/room-inventory/${id}`, "PATCH", patch);
    },
    []
  );

  const removeRoomInventoryItem = useCallback((id: string) => {
    setRoomInventory((prev) => prev.filter((r) => r.id !== id));
    del(`/api/app/room-inventory/${id}`);
  }, []);

  const updateDiscountCaps = useCallback(
    (caps: DiscountCaps) => {
      setDiscountCapsState(caps);
      sync("/api/app/settings", "PUT", { discountCaps: caps });
    },
    []
  );

  const updatePackageRates = useCallback(
    (rates: PackageRates) => {
      setPackageRatesState(rates);
      sync("/api/app/settings", "PUT", { packageRates: rates });
    },
    []
  );

  const addSpecialDay = useCallback((sd: SpecialDay) => {
    setSpecialDays((prev) => [...prev, sd].sort((a, b) => (a.date < b.date ? -1 : 1)));
    sync("/api/app/special-days", "POST", sd);
  }, []);

  const removeSpecialDay = useCallback((id: string) => {
    setSpecialDays((prev) => prev.filter((sd) => sd.id !== id));
    del(`/api/app/special-days/${id}`);
  }, []);

  const updateCreditNoteSettings = useCallback(
    (s: CreditNoteSettings) => {
      setCreditNoteSettings(s);
      sync("/api/app/settings", "PUT", { creditNoteSettings: s });
    },
    []
  );

  const updateGstSettings = useCallback(
    (s: GstSettings) => {
      setGstSettings(s);
      sync("/api/app/settings", "PUT", { gstSettings: s });
    },
    []
  );

  const updateCancellationPolicy = useCallback(
    (p: CancellationPolicy) => {
      setCancellationPolicy(p);
      sync("/api/app/settings", "PUT", { cancellationPolicy: p });
    },
    []
  );

  const updateVenueTypes = useCallback((types: string[]) => {
    setVenueTypesState(types);
    sync("/api/app/settings", "PUT", { venueTypes: types });
  }, []);

  const updateUserRoles = useCallback((roles: string[]) => {
    setUserRolesState(roles);
    sync("/api/app/settings", "PUT", { userRoles: roles });
  }, []);

  const addVenue = useCallback((v: Venue) => {
    setVenues((prev) => [...prev, v]);
    sync("/api/app/venues", "POST", v);
  }, []);

  const updateVenue = useCallback((id: string, patch: Partial<Venue>) => {
    setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    sync(`/api/app/venues/${id}`, "PATCH", patch);
  }, []);

  const removeVenue = useCallback((id: string) => {
    setVenues((prev) => prev.filter((v) => v.id !== id));
    del(`/api/app/venues/${id}`);
  }, []);

  const addVenueBlock = useCallback((vb: VenueBlock) => {
    setVenueBlocks((prev) => [...prev, vb]);
    sync("/api/app/venue-blocks", "POST", vb);
  }, []);

  const updateVenueBlock = useCallback(
    (id: string, patch: Partial<VenueBlock>) => {
      setVenueBlocks((prev) =>
        prev.map((vb) => (vb.id === id ? { ...vb, ...patch } : vb))
      );
      sync(`/api/app/venue-blocks/${id}`, "PATCH", patch);
    },
    []
  );

  const removeVenueBlock = useCallback((id: string) => {
    setVenueBlocks((prev) => prev.filter((vb) => vb.id !== id));
    del(`/api/app/venue-blocks/${id}`);
  }, []);

  const addBulkRoomBlock = useCallback((b: BulkRoomBlock) => {
    setBulkRoomBlocks((prev) => [...prev, b]);
    sync("/api/app/bulk-blocks", "POST", b);
  }, []);

  const updateBulkRoomBlock = useCallback((id: string, patch: Partial<BulkRoomBlock>) => {
    setBulkRoomBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    sync(`/api/app/bulk-blocks/${id}`, "PATCH", patch);
  }, []);

  const removeBulkRoomBlock = useCallback((id: string) => {
    setBulkRoomBlocks((prev) => prev.filter((b) => b.id !== id));
    del(`/api/app/bulk-blocks/${id}`);
  }, []);

  const markLost = useCallback(
    (bookingId: string, reason: string, notes: string) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                status: "Lost",
                lostReason: reason,
                lostNotes: notes,
                allocatedRooms: [],
              }
            : b
        )
      );
      sync(`/api/app/bookings/${bookingId}`, "PATCH", { status: "Lost", lostReason: reason, lostNotes: notes, allocatedRooms: [] });
    },
    []
  );

  const recordPayment = useCallback(
    (bookingId: string, amount: number, mode: string, type: string, creditNoteCode?: string) => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          const newAdvance = b.advance + amount;
          const newBalance = Math.max(0, b.grandTotal - newAdvance);
          const payments = [
            ...b.payments,
            {
              date: todayStr(),
              time: nowTime(),
              type,
              amount,
              mode,
              by: currentUser,
              ...(creditNoteCode ? { creditNoteCode } : {}),
            },
          ];
          const newStatus =
            b.status === "Enquiry" || b.status === "Tentative"
              ? "Confirmed"
              : b.status;
          sync(`/api/app/bookings/${bookingId}`, "PATCH", {
            advance: newAdvance,
            balance: newBalance,
            payments,
            status: newStatus,
          });
          return {
            ...b,
            advance: newAdvance,
            balance: newBalance,
            payments,
            status: newStatus,
          };
        })
      );
    },
    [currentUser]
  );

  const completeBooking = useCallback(
    (bookingId: string, extras: Extra[], extraNights: number) => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          let grandTotal = b.grandTotal;
          let balance = b.balance;
          let nights = b.nights;
          let checkout = b.checkout;
          const newExtras = [...b.extras];
          extras.forEach((e) => {
            if (e.name && e.amount > 0) {
              newExtras.push(e);
              grandTotal += e.amount;
              balance = Math.max(0, balance + e.amount);
            }
          });
          if (extraNights > 0 && b.nights > 0) {
            const perNight = b.totalRoomCharges / b.nights;
            grandTotal += perNight * extraNights;
            balance = Math.max(0, balance + perNight * extraNights);
            nights += extraNights;
            checkout = addDays(checkout, extraNights);
          }
          sync(`/api/app/bookings/${bookingId}`, "PATCH", {
            extras: newExtras,
            grandTotal,
            balance,
            nights,
            checkout,
            status: "Completed",
          });
          return {
            ...b,
            extras: newExtras,
            grandTotal,
            balance,
            nights,
            checkout,
            status: "Completed",
          };
        })
      );
    },
    []
  );

  const setAllocatedRooms = useCallback((bookingId: string, rooms: string[]) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, allocatedRooms: rooms } : b))
    );
    sync(`/api/app/bookings/${bookingId}`, "PATCH", { allocatedRooms: rooms });
  }, []);

  const applyNightOverride = useCallback(
    (
      bookingId: string,
      opts: {
        date: string;
        fromRoomId: string;
        toRoomId: string;
        upgrade?: RoomNightUpgrade;
      }
    ) => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          // Replace any existing override for the same (date, fromRoomId)
          const existing = (b.nightOverrides || []).filter(
            (o) => !(o.date === opts.date && o.fromRoomId === opts.fromRoomId)
          );
          const nextOverrides = [
            ...existing,
            {
              date: opts.date,
              fromRoomId: opts.fromRoomId,
              toRoomId: opts.toRoomId,
              upgrade: opts.upgrade,
            },
          ];
          const newExtras = [...b.extras];
          let grandTotal = b.grandTotal;
          let balance = b.balance;
          if (
            opts.upgrade &&
            opts.upgrade.kind === "paid" &&
            opts.upgrade.extraAmount > 0
          ) {
            newExtras.push({
              name: `Room Upgrade (${opts.date}): ${opts.upgrade.fromCategoryName} → ${opts.upgrade.toCategoryName}`,
              amount: opts.upgrade.extraAmount,
              date: opts.upgrade.upgradeDate,
              by: opts.upgrade.by,
            });
            grandTotal += opts.upgrade.extraAmount;
            balance += opts.upgrade.extraAmount;
          }
          sync(`/api/app/bookings/${bookingId}`, "PATCH", {
            nightOverrides: nextOverrides,
            extras: newExtras,
            grandTotal,
            balance,
          });
          return {
            ...b,
            nightOverrides: nextOverrides,
            extras: newExtras,
            grandTotal,
            balance,
          };
        })
      );
    },
    []
  );

  const clearNightOverride = useCallback(
    (bookingId: string, date: string, fromRoomId: string) => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          const removed = (b.nightOverrides || []).find(
            (o) => o.date === date && o.fromRoomId === fromRoomId
          );
          if (!removed) return b;
          const nextOverrides = (b.nightOverrides || []).filter(
            (o) => !(o.date === date && o.fromRoomId === fromRoomId)
          );
          // If the removed override had a paid upgrade, reverse it: remove the
          // matching Extra entry and decrement totals.
          let newExtras = b.extras;
          let grandTotal = b.grandTotal;
          let balance = b.balance;
          if (
            removed.upgrade &&
            removed.upgrade.kind === "paid" &&
            removed.upgrade.extraAmount > 0
          ) {
            const upgName = `Room Upgrade (${removed.date}): ${removed.upgrade.fromCategoryName} → ${removed.upgrade.toCategoryName}`;
            const idx = newExtras.findIndex(
              (e) =>
                e.name === upgName && e.amount === removed.upgrade!.extraAmount
            );
            if (idx >= 0) {
              newExtras = [
                ...newExtras.slice(0, idx),
                ...newExtras.slice(idx + 1),
              ];
              grandTotal -= removed.upgrade.extraAmount;
              balance = Math.max(0, balance - removed.upgrade.extraAmount);
            }
          }
          sync(`/api/app/bookings/${bookingId}`, "PATCH", {
            nightOverrides: nextOverrides,
            extras: newExtras,
            grandTotal,
            balance,
          });
          return {
            ...b,
            nightOverrides: nextOverrides,
            extras: newExtras,
            grandTotal,
            balance,
          };
        })
      );
    },
    []
  );

  const revenueEntries = useMemo<RevenueEntry[]>(() => {
    const entries: RevenueEntry[] = [];
    bookings.forEach((b) => {
      b.payments.forEach((p) => {
        entries.push({ ...p, bookingId: b.id, guest: b.guest });
      });
      b.extras.forEach((e) => {
        entries.push({
          date: e.date || b.checkout || todayStr(),
          time: "—",
          type: "Extra: " + e.name,
          amount: e.amount,
          mode: "Cash",
          by: e.by || b.rex || currentUser,
          bookingId: b.id,
          guest: b.guest,
        });
      });
    });
    entries.sort((a, b) => (a.date < b.date ? 1 : -1));
    return entries;
  }, [bookings, currentUser]);

  const value = useMemo<AppContextValue>(
    () => ({
      isAuthed,
      sessionChecking,
      currentRole,
      currentUser,
      login,
      logout,
      bookings,
      hydrated,
      revenueEntries,
      guestNotes,
      setGuestNote,
      createBooking,
      updateBooking,
      cancelBooking,
      redeemCreditNote,
      addExtras,
      markLost,
      recordPayment,
      completeBooking,
      setAllocatedRooms,
      applyNightOverride,
      clearNightOverride,
      rooms,
      roomInventory,
      discountCaps,
      packageRates,
      specialDays,
      creditNoteSettings,
      creditNotes,
      gstSettings,
      cancellationPolicy,
      venues,
      venueTypes,
      updateVenueTypes,
      userRoles,
      updateUserRoles,
      venueBlocks,
      updateRooms,
      addRoomInventoryItem,
      updateRoomInventoryItem,
      removeRoomInventoryItem,
      updateDiscountCaps,
      updatePackageRates,
      addSpecialDay,
      removeSpecialDay,
      updateCreditNoteSettings,
      updateGstSettings,
      updateCancellationPolicy,
      addVenue,
      updateVenue,
      removeVenue,
      addVenueBlock,
      updateVenueBlock,
      removeVenueBlock,
      bulkRoomBlocks,
      addBulkRoomBlock,
      updateBulkRoomBlock,
      removeBulkRoomBlock,
      notif,
      showNotif,
      modal,
      openModal,
      closeModal: closeModalCb,
    }),
    [
      isAuthed,
      sessionChecking,
      currentRole,
      currentUser,
      login,
      logout,
      bookings,
      hydrated,
      revenueEntries,
      guestNotes,
      setGuestNote,
      createBooking,
      updateBooking,
      addExtras,
      markLost,
      recordPayment,
      completeBooking,
      setAllocatedRooms,
      applyNightOverride,
      clearNightOverride,
      rooms,
      roomInventory,
      discountCaps,
      packageRates,
      specialDays,
      creditNoteSettings,
      creditNotes,
      cancelBooking,
      redeemCreditNote,
      gstSettings,
      cancellationPolicy,
      venues,
      venueTypes,
      updateVenueTypes,
      userRoles,
      updateUserRoles,
      venueBlocks,
      updateRooms,
      addRoomInventoryItem,
      updateRoomInventoryItem,
      removeRoomInventoryItem,
      updateDiscountCaps,
      updatePackageRates,
      addSpecialDay,
      removeSpecialDay,
      updateCreditNoteSettings,
      updateGstSettings,
      updateCancellationPolicy,
      addVenue,
      updateVenue,
      removeVenue,
      addVenueBlock,
      updateVenueBlock,
      removeVenueBlock,
      bulkRoomBlocks,
      addBulkRoomBlock,
      updateBulkRoomBlock,
      removeBulkRoomBlock,
      notif,
      showNotif,
      modal,
      openModal,
      closeModalCb,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
