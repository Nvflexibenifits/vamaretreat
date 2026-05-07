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

type ModalKind =
  | "lost"
  | "payment"
  | "complete"
  | "quote"
  | "crm-note"
  | null;

type QuotePayload =
  | { kind: "preview"; booking: Booking }
  | { kind: "saved"; bookingId: string };

type ModalState = {
  kind: ModalKind;
  bookingId?: string | null;
  quote?: QuotePayload;
  crmKey?: { mobile: string; name: string };
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
  revenueEntries: RevenueEntry[];
  guestNotes: Record<string, string>;
  setGuestNote: (mobile: string, note: string) => void;
  createBooking: (b: Booking) => void;
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
  allocateRoom: (bookingId: string, roomId: string) => void;
  // room chart selection
  selectedBookingForAlloc: string | null;
  setSelectedBookingForAlloc: (id: string | null) => void;
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

  const [selectedBookingForAlloc, setSelectedBookingForAlloc] = useState<
    string | null
  >(null);

  const [notif, setNotif] = useState<{ msg: string; kind: NotifKind } | null>(
    null
  );
  const [modal, setModal] = useState<ModalState>({ kind: null });

  // notification auto-dismiss
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

  const markLost = useCallback(
    (bookingId: string, reason: string, notes: string) => {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: "Lost", lostReason: reason, lostNotes: notes }
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
          const newBalance = Math.max(0, b.total - newAdvance);
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
            status: b.status === "Draft" ? "Confirmed" : b.status,
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
          let total = b.total;
          let balance = b.balance;
          let nights = b.nights;
          let checkout = b.checkout;
          const newExtras = [...b.extras];
          extras.forEach((e) => {
            if (e.name && e.amount > 0) {
              newExtras.push(e);
              total += e.amount;
              balance = Math.max(0, balance + e.amount);
            }
          });
          if (extraNights > 0) {
            const perNight = b.roomTotal / b.nights;
            total += perNight * extraNights;
            balance = Math.max(0, balance + perNight * extraNights);
            nights += extraNights;
            checkout = addDays(checkout, extraNights);
          }
          return {
            ...b,
            extras: newExtras,
            total,
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

  const allocateRoom = useCallback(
    (bookingId: string, roomId: string) => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== bookingId) return b;
          return {
            ...b,
            allocatedRoom: roomId,
            payments: [
              ...b.payments,
              {
                date: todayStr(),
                time: nowTime(),
                type: "Room Allocated: " + roomId,
                amount: 0,
                mode: "—",
                by: currentUser,
              },
            ],
          };
        })
      );
    },
    [currentUser]
  );

  const revenueEntries = useMemo<RevenueEntry[]>(() => {
    const entries: RevenueEntry[] = [];
    bookings.forEach((b) => {
      b.payments.forEach((p) => {
        entries.push({ ...p, bookingId: b.id, guest: b.guest });
      });
      b.extras.forEach((e) => {
        entries.push({
          date: b.checkout || todayStr(),
          time: "—",
          type: "Extra: " + e.name,
          amount: e.amount,
          mode: "Cash",
          by: b.rex || currentUser,
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
      revenueEntries,
      guestNotes,
      setGuestNote,
      createBooking,
      markLost,
      recordPayment,
      completeBooking,
      allocateRoom,
      selectedBookingForAlloc,
      setSelectedBookingForAlloc,
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
      revenueEntries,
      guestNotes,
      setGuestNote,
      createBooking,
      markLost,
      recordPayment,
      completeBooking,
      allocateRoom,
      selectedBookingForAlloc,
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
