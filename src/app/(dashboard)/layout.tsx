"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { LostModal } from "@/components/modals/LostModal";
import { PaymentModal } from "@/components/modals/PaymentModal";
import { CompleteModal } from "@/components/modals/CompleteModal";
import { CrmNoteModal } from "@/components/modals/CrmNoteModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthed, sessionChecking } = useApp();

  useEffect(() => {
    if (!sessionChecking && !isAuthed) router.replace("/login");
  }, [isAuthed, sessionChecking, router]);

  // Select-all on focus for every number input, app-wide: typing into a
  // pre-filled field (e.g. "2" adults) replaces the value instead of
  // appending to it. The one-shot mouseup guard stops the click that gave
  // focus from collapsing the selection; later clicks behave normally.
  useEffect(() => {
    let justFocused: HTMLInputElement | null = null;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type === "number") {
        t.select();
        justFocused = t;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (justFocused && e.target === justFocused) e.preventDefault();
      justFocused = null;
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (sessionChecking || !isAuthed) return null;

  return (
    <div id="app">
      <Sidebar />
      <div id="main">
        <Topbar />
        <div id="views">{children}</div>
      </div>
      <LostModal />
      <PaymentModal />
      <CompleteModal />
      <CrmNoteModal />
    </div>
  );
}
