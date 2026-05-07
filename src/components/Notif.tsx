"use client";

import { useApp } from "@/lib/store";

export function Notif() {
  const { notif } = useApp();
  if (!notif) return null;
  return (
    <div className={`notif ${notif.kind}`}>{notif.msg}</div>
  );
}
