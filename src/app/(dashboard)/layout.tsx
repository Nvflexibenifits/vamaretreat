"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { LostModal } from "@/components/modals/LostModal";
import { PaymentModal } from "@/components/modals/PaymentModal";
import { CompleteModal } from "@/components/modals/CompleteModal";
import { QuoteModal } from "@/components/modals/QuoteModal";
import { CrmNoteModal } from "@/components/modals/CrmNoteModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthed } = useApp();

  useEffect(() => {
    if (!isAuthed) router.replace("/login");
  }, [isAuthed, router]);

  if (!isAuthed) return null;

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
      <QuoteModal />
      <CrmNoteModal />
    </div>
  );
}
