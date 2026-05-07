"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { ROOM_INVENTORY } from "@/lib/data";
import { todayStr } from "@/lib/utils";
import type { Booking } from "@/types";

export default function RoomChartPage() {
  const router = useRouter();
  const {
    bookings,
    selectedBookingForAlloc,
    setSelectedBookingForAlloc,
    allocateRoom,
    showNotif,
  } = useApp();

  const [offset, setOffset] = useState(0);
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(todayStr());
  }, []);

  const dates = useMemo(() => {
    const out: string[] = [];
    if (!today) return out;
    const start = new Date(today);
    start.setDate(start.getDate() + offset);
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      out.push(d.toISOString().split("T")[0]);
    }
    return out;
  }, [offset, today]);

  const bookingMap = useMemo(() => {
    const map: Record<string, Booking> = {};
    bookings
      .filter((b) => b.allocatedRoom && (b.status === "Confirmed" || b.status === "Completed"))
      .forEach((b) => {
        const cur = new Date(b.checkin);
        const end = new Date(b.checkout);
        while (cur < end) {
          const ds = cur.toISOString().split("T")[0];
          map[b.allocatedRoom + "|" + ds] = b;
          cur.setDate(cur.getDate() + 1);
        }
      });
    return map;
  }, [bookings]);

  const unalloc = bookings.filter((b) => b.status === "Confirmed" && !b.allocatedRoom);

  const onSelectAlloc = (id: string) => {
    const next = selectedBookingForAlloc === id ? null : id;
    setSelectedBookingForAlloc(next);
    if (next) showNotif("Now click an available cell in the chart to assign a room", "success");
  };

  const onAllocate = (roomId: string) => {
    if (!selectedBookingForAlloc) return;
    const b = bookings.find((x) => x.id === selectedBookingForAlloc);
    if (!b) return;
    allocateRoom(b.id, roomId);
    setSelectedBookingForAlloc(null);
    showNotif(`Room ${roomId} allocated to ${b.guest} ✓`, "success");
  };

  return (
    <div className="view">
      <div className="pg-hd">
        <div>
          <h2>Room Chart</h2>
          <p>14-day availability view — click a confirmed booking to allocate a room</p>
        </div>
        <div className="pg-hd-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset((o) => o - 7)}>◀ Previous</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset((o) => o + 7)}>Next ▶</button>
        </div>
      </div>

      {unalloc.length > 0 && (
        <div className="unalloc-banner">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--amb)" }}>
              📌 {unalloc.length} booking{unalloc.length > 1 ? "s" : ""} awaiting room allocation
            </div>
            <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>
              Click a booking card, then click an available cell in the chart below to allocate.
            </div>
            <div className="unalloc-banner-cards">
              {unalloc.map((b) => (
                <div
                  key={b.id}
                  className={`unalloc-card${selectedBookingForAlloc === b.id ? " selected" : ""}`}
                  onClick={() => onSelectAlloc(b.id)}
                >
                  <div className="unalloc-card-name">{b.guest}</div>
                  <div className="unalloc-card-meta">
                    {b.checkin} · {b.rooms.map((r) => r.name).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rc-wrap">
        <div className="rc-hd">
          <h3>Room Availability</h3>
          <div
            className="rc-legend"
            style={{ marginLeft: "auto", padding: 0, border: "none", background: "transparent", gap: 12 }}
          >
            <div className="rc-legend-item">
              <div className="rc-legend-dot" style={{ background: "var(--amb-bg)", border: "1px solid var(--amb)" }}></div>
              Confirmed
            </div>
            <div className="rc-legend-item">
              <div className="rc-legend-dot" style={{ background: "var(--grn-bg)", border: "1px solid var(--grn)" }}></div>
              Completed
            </div>
            <div className="rc-legend-item">
              <div className="rc-legend-dot" style={{ background: "var(--bd)" }}></div>
              Available
            </div>
          </div>
        </div>
        <div className="rc-table-wrap">
          <table className="rc-table">
            <thead>
              <tr>
                <th className="rc-room-col">Room</th>
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
                      {dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {ROOM_INVENTORY.map((room) => (
                <tr key={room.id}>
                  <td className="rc-room-label">
                    {room.label}
                    <small>{room.type}</small>
                  </td>
                  {dates.map((d) => {
                    const isToday = d === today;
                    const booking = bookingMap[room.id + "|" + d];
                    if (booking) {
                      const cls =
                        "rc-cell-booked" + (booking.status === "Completed" ? " status-completed" : "");
                      return (
                        <td key={d} className={isToday ? "rc-today" : ""} style={{ padding: 4 }}>
                          <div
                            className={cls}
                            onClick={() => router.push(`/bookings/${booking.id}`)}
                            title={booking.guest}
                          >
                            {booking.guest.split(" ")[0]}
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={d}
                        className={isToday ? "rc-today" : ""}
                        onClick={selectedBookingForAlloc ? () => onAllocate(room.id) : undefined}
                        style={
                          selectedBookingForAlloc
                            ? { cursor: "pointer", background: "var(--grn-lt)" }
                            : undefined
                        }
                      ></td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
