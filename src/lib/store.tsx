"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  Booking,
  CancellationPolicy,
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
  User,
  Venue,
  VenueBlock,
} from "@/types";
import {
  ROOMS as SEED_ROOMS,
  SEED_BOOKINGS,
  SEED_CANCELLATION_POLICY,
  SEED_CREDIT_NOTE_SETTINGS,
  SEED_DISCOUNT_CAPS,
  SEED_GST_SETTINGS,
  SEED_PACKAGE_RATES,
  SEED_ROOM_INVENTORY,
  SEED_SPECIAL_DAYS,
  SEED_USERS,
  SEED_VENUES,
  SEED_VENUE_BLOCKS,
} from "@/lib/data";
import { addDays, nowTime, todayStr } from "@/lib/utils";

const STORAGE_KEY = "vama:state:v2";
const LEGACY_KEY = "vama:state:v1";

type ModalKind = "lost" | "payment" | "complete" | "crm-note" | null;

type ModalState = {
  kind: ModalKind;
  bookingId?: string | null;
  crmKey?: { mobile: string; name: string };
};

type PersistedState = {
  bookings: Booking[];
  guestNotes: Record<string, string>;
  rooms?: RoomMaster[];
  roomInventory?: RoomInventoryItem[];
  discountCaps?: DiscountCaps;
  packageRates?: PackageRates;
  specialDays?: SpecialDay[];
  creditNoteSettings?: CreditNoteSettings;
  gstSettings?: GstSettings;
  cancellationPolicy?: CancellationPolicy;
  users?: User[];
  venues?: Venue[];
  venueBlocks?: VenueBlock[];
};

type AppContextValue = {
  // auth
  isAuthed: boolean;
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
  markLost: (bookingId: string, reason: string, notes: string) => void;
  recordPayment: (
    bookingId: string,
    amount: number,
    mode: string,
    type: string
  ) => void;
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
  users: User[];
  venues: Venue[];
  venueBlocks: VenueBlock[];
  updateRooms: (rooms: RoomMaster[]) => void;
  addRoomInventoryItem: (item: RoomInventoryItem) => void;
  updateRoomInventoryItem: (id: string, patch: Partial<RoomInventoryItem>) => void;
  updateDiscountCaps: (caps: DiscountCaps) => void;
  updatePackageRates: (rates: PackageRates) => void;
  addSpecialDay: (sd: SpecialDay) => void;
  removeSpecialDay: (id: string) => void;
  updateCreditNoteSettings: (s: CreditNoteSettings) => void;
  updateGstSettings: (s: GstSettings) => void;
  updateCancellationPolicy: (p: CancellationPolicy) => void;
  addUser: (u: User) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  removeUser: (id: string) => void;
  addVenue: (v: Venue) => void;
  updateVenue: (id: string, patch: Partial<Venue>) => void;
  removeVenue: (id: string) => void;
  addVenueBlock: (vb: VenueBlock) => void;
  updateVenueBlock: (id: string, patch: Partial<VenueBlock>) => void;
  removeVenueBlock: (id: string) => void;
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
    pricingRows: Array.isArray(b.pricingRows) ? b.pricingRows : [],
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
  const [currentRole, setCurrentRole] = useState<Role>("Sales REX");
  const [currentUser, setCurrentUser] = useState<string>("Karthik");

  const [bookings, setBookings] = useState<Booking[]>(SEED_BOOKINGS);
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
  const [gstSettings, setGstSettings] =
    useState<GstSettings>(SEED_GST_SETTINGS);
  const [cancellationPolicy, setCancellationPolicy] =
    useState<CancellationPolicy>(SEED_CANCELLATION_POLICY);
  const [users, setUsers] = useState<User[]>(SEED_USERS);
  const [venues, setVenues] = useState<Venue[]>(SEED_VENUES);
  const [venueBlocks, setVenueBlocks] = useState<VenueBlock[]>(SEED_VENUE_BLOCKS);
  const [hydrated, setHydrated] = useState(false);

  const [notif, setNotif] = useState<{ msg: string; kind: NotifKind } | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: null });

  // Hydrate from localStorage on mount.
  // v2 key: full restore. If not present, migrate user data from v1 (bookings,
  // users, venues) but intentionally drop all master-setup config so new seed
  // prices and rates are applied cleanly.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (Array.isArray(parsed.bookings) && parsed.bookings.length > 0) {
          setBookings((parsed.bookings as Partial<Booking>[]).map(normalizeBooking));
        }
        if (parsed.guestNotes && typeof parsed.guestNotes === "object") {
          setGuestNotes(parsed.guestNotes);
        }
        if (Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
          setRooms(parsed.rooms);
        }
        if (Array.isArray(parsed.roomInventory) && parsed.roomInventory.length > 0) {
          setRoomInventory(parsed.roomInventory);
        }
        if (parsed.discountCaps) setDiscountCapsState(parsed.discountCaps);
        if (parsed.packageRates) setPackageRatesState({ ...SEED_PACKAGE_RATES, ...parsed.packageRates });
        if (Array.isArray(parsed.specialDays)) setSpecialDays(parsed.specialDays);
        if (parsed.creditNoteSettings) setCreditNoteSettings(parsed.creditNoteSettings);
        if (parsed.gstSettings) setGstSettings(parsed.gstSettings);
        if (parsed.cancellationPolicy && "standardThreshold" in parsed.cancellationPolicy) setCancellationPolicy(parsed.cancellationPolicy);
        if (Array.isArray(parsed.users) && parsed.users.length > 0) {
          setUsers(parsed.users);
        }
        if (Array.isArray(parsed.venues)) setVenues(parsed.venues);
        if (Array.isArray(parsed.venueBlocks)) setVenueBlocks(parsed.venueBlocks);
      } else {
        // No v2 data — check for v1 and migrate user data only.
        const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw) as Partial<PersistedState>;
          if (Array.isArray(legacy.bookings) && legacy.bookings.length > 0) {
            setBookings((legacy.bookings as Partial<Booking>[]).map(normalizeBooking));
          }
          if (legacy.guestNotes && typeof legacy.guestNotes === "object") {
            setGuestNotes(legacy.guestNotes);
          }
          if (Array.isArray(legacy.users) && legacy.users.length > 0) {
            setUsers(legacy.users);
          }
          if (Array.isArray(legacy.venues)) setVenues(legacy.venues);
          if (Array.isArray(legacy.venueBlocks)) setVenueBlocks(legacy.venueBlocks);
          // All master-setup config (rooms, rates, GST, cancellation policy, etc.)
          // intentionally reset to new seeds — do not restore from v1.
          window.localStorage.removeItem(LEGACY_KEY);
        }
      }
    } catch {
      // corrupt state, ignore and stay on seed
    }
    setHydrated(true);
  }, []);

  // Persist on change
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      const payload: PersistedState = {
        bookings,
        guestNotes,
        rooms,
        roomInventory,
        discountCaps,
        packageRates,
        specialDays,
        creditNoteSettings,
        gstSettings,
        cancellationPolicy,
        users,
        venues,
        venueBlocks,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // quota / serialization, swallow
    }
  }, [
    hydrated,
    bookings,
    guestNotes,
    rooms,
    roomInventory,
    discountCaps,
    packageRates,
    specialDays,
    creditNoteSettings,
    gstSettings,
    cancellationPolicy,
    users,
    venues,
    venueBlocks,
  ]);

  // Sync from other tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as Partial<PersistedState>;
        if (Array.isArray(parsed.bookings))
          setBookings(
            (parsed.bookings as Partial<Booking>[]).map(normalizeBooking)
          );
        if (parsed.guestNotes && typeof parsed.guestNotes === "object") {
          setGuestNotes(parsed.guestNotes);
        }
        if (Array.isArray(parsed.rooms) && parsed.rooms.length > 0) {
          setRooms(parsed.rooms);
        }
        if (Array.isArray(parsed.roomInventory) && parsed.roomInventory.length > 0) {
          setRoomInventory(parsed.roomInventory);
        }
        if (parsed.discountCaps) setDiscountCapsState(parsed.discountCaps);
        if (parsed.packageRates) setPackageRatesState({ ...SEED_PACKAGE_RATES, ...parsed.packageRates });
        if (Array.isArray(parsed.specialDays)) setSpecialDays(parsed.specialDays);
        if (parsed.creditNoteSettings) setCreditNoteSettings(parsed.creditNoteSettings);
        if (parsed.gstSettings) setGstSettings(parsed.gstSettings);
        if (parsed.cancellationPolicy && "standardThreshold" in parsed.cancellationPolicy) setCancellationPolicy(parsed.cancellationPolicy);
        if (Array.isArray(parsed.users) && parsed.users.length > 0) {
          setUsers(parsed.users);
        }
        if (Array.isArray(parsed.venues)) setVenues(parsed.venues);
        if (Array.isArray(parsed.venueBlocks)) setVenueBlocks(parsed.venueBlocks);
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Notification auto-dismiss
  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(() => setNotif(null), 3000);
    return () => clearTimeout(t);
  }, [notif]);

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
    setGuestNotes((prev) => ({ ...prev, [mobile]: note }));
  }, []);

  const createBooking = useCallback((b: Booking) => {
    setBookings((prev) => [b, ...prev]);
  }, []);

  const updateBooking = useCallback((bookingId: string, patch: Partial<Booking>) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, ...patch } : b))
    );
  }, []);

  // ─── Master setup setters ───
  const updateRooms = useCallback((next: RoomMaster[]) => setRooms(next), []);
  const addRoomInventoryItem = useCallback((item: RoomInventoryItem) => {
    setRoomInventory((prev) => [...prev, item]);
  }, []);
  const updateRoomInventoryItem = useCallback(
    (id: string, patch: Partial<RoomInventoryItem>) => {
      setRoomInventory((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
    },
    []
  );
  const updateDiscountCaps = useCallback(
    (caps: DiscountCaps) => setDiscountCapsState(caps),
    []
  );
  const updatePackageRates = useCallback(
    (rates: PackageRates) => setPackageRatesState(rates),
    []
  );
  const addSpecialDay = useCallback((sd: SpecialDay) => {
    setSpecialDays((prev) => [...prev, sd].sort((a, b) => (a.date < b.date ? -1 : 1)));
  }, []);
  const removeSpecialDay = useCallback((id: string) => {
    setSpecialDays((prev) => prev.filter((sd) => sd.id !== id));
  }, []);
  const updateCreditNoteSettings = useCallback(
    (s: CreditNoteSettings) => setCreditNoteSettings(s),
    []
  );
  const updateGstSettings = useCallback(
    (s: GstSettings) => setGstSettings(s),
    []
  );
  const updateCancellationPolicy = useCallback(
    (p: CancellationPolicy) => setCancellationPolicy(p),
    []
  );
  const addUser = useCallback((u: User) => {
    setUsers((prev) => [...prev, u]);
  }, []);
  const updateUser = useCallback((id: string, patch: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);
  const removeUser = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const addVenue = useCallback((v: Venue) => {
    setVenues((prev) => [...prev, v]);
  }, []);
  const updateVenue = useCallback((id: string, patch: Partial<Venue>) => {
    setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }, []);
  const removeVenue = useCallback((id: string) => {
    setVenues((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const addVenueBlock = useCallback((vb: VenueBlock) => {
    setVenueBlocks((prev) => [...prev, vb]);
  }, []);
  const updateVenueBlock = useCallback(
    (id: string, patch: Partial<VenueBlock>) => {
      setVenueBlocks((prev) =>
        prev.map((vb) => (vb.id === id ? { ...vb, ...patch } : vb))
      );
    },
    []
  );
  const removeVenueBlock = useCallback((id: string) => {
    setVenueBlocks((prev) => prev.filter((vb) => vb.id !== id));
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
    },
    []
  );

  const recordPayment = useCallback(
    (bookingId: string, amount: number, mode: string, type: string) => {
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
            },
          ];
          return {
            ...b,
            advance: newAdvance,
            balance: newBalance,
            payments,
            status:
              b.status === "Enquiry" || b.status === "Tentative"
                ? "Confirmed"
                : b.status,
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
      gstSettings,
      cancellationPolicy,
      users,
      venues,
      venueBlocks,
      updateRooms,
      addRoomInventoryItem,
      updateRoomInventoryItem,
      updateDiscountCaps,
      updatePackageRates,
      addSpecialDay,
      removeSpecialDay,
      updateCreditNoteSettings,
      updateGstSettings,
      updateCancellationPolicy,
      addUser,
      updateUser,
      removeUser,
      addVenue,
      updateVenue,
      removeVenue,
      addVenueBlock,
      updateVenueBlock,
      removeVenueBlock,
      notif,
      showNotif,
      modal,
      openModal,
      closeModal: closeModalCb,
    }),
    [
      isAuthed,
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
      gstSettings,
      cancellationPolicy,
      users,
      venues,
      venueBlocks,
      updateRooms,
      addRoomInventoryItem,
      updateRoomInventoryItem,
      updateDiscountCaps,
      updatePackageRates,
      addSpecialDay,
      removeSpecialDay,
      updateCreditNoteSettings,
      updateGstSettings,
      updateCancellationPolicy,
      addUser,
      updateUser,
      removeUser,
      addVenue,
      updateVenue,
      removeVenue,
      addVenueBlock,
      updateVenueBlock,
      removeVenueBlock,
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
