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
