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
  Extra,
  NotifKind,
  RevenueEntry,
  Role,
} from "@/types";
import { SEED_BOOKINGS } from "@/lib/data";
import { addDays, nowTime, todayStr } from "@/lib/utils";

const STORAGE_KEY = "vama:state:v1";

type ModalKind = "lost" | "payment" | "complete" | "crm-note" | null;

type ModalState = {
  kind: ModalKind;
  bookingId?: string | null;
  crmKey?: { mobile: string; name: string };
};

type PersistedState = {
  bookings: Booking[];
  guestNotes: Record<string, string>;
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
  // notification
  notif: { msg: string; kind: NotifKind } | null;
  showNotif: (msg: string, kind?: NotifKind) => void;
  // modal
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>("Sales REX");
  const [currentUser, setCurrentUser] = useState<string>("Karthik");

  const [bookings, setBookings] = useState<Booking[]>(SEED_BOOKINGS);
  const [guestNotes, setGuestNotes] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  const [notif, setNotif] = useState<{ msg: string; kind: NotifKind } | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: null });

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (Array.isArray(parsed.bookings) && parsed.bookings.length > 0) {
          setBookings(parsed.bookings as Booking[]);
        }
        if (parsed.guestNotes && typeof parsed.guestNotes === "object") {
          setGuestNotes(parsed.guestNotes);
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
      const payload: PersistedState = { bookings, guestNotes };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // quota / serialization, swallow
    }
  }, [hydrated, bookings, guestNotes]);

  // Sync from other tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as Partial<PersistedState>;
        if (Array.isArray(parsed.bookings)) setBookings(parsed.bookings as Booking[]);
        if (parsed.guestNotes && typeof parsed.guestNotes === "object") {
          setGuestNotes(parsed.guestNotes);
        }
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
