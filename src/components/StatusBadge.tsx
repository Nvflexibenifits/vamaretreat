import type { BookingStatus } from "@/types";
import { statusBadgeClass } from "@/lib/utils";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>
  );
}
