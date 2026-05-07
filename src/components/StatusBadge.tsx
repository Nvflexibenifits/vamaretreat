import type { BookingStatus } from "@/types";
import { statusBadgeClass, statusBadgeDot } from "@/lib/utils";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`badge ${statusBadgeClass(status)}`}>
      {statusBadgeDot(status)} {status}
    </span>
  );
}
