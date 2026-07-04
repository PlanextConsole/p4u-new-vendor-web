import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";
import type { VendorBookingRow } from "@/lib/api/vendorBookings";

export function metaRecord(m: unknown): Record<string, unknown> {
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  return m as Record<string, unknown>;
}

export function formatInr(amount: string | number): string {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount || "0"));
  if (!Number.isFinite(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function displaySettlementRef(row: VendorSettlementRow): string {
  const md = metaRecord(row.metadata);
  const code =
    (typeof md.displayRef === "string" && md.displayRef.trim()) ||
    (typeof md.settlementCode === "string" && md.settlementCode.trim()) ||
    (typeof md.code === "string" && md.code.trim()) ||
    "";
  if (code) return code;
  const raw = row.id.replace(/-/g, "");
  return `STL-${raw.slice(0, 3)}-${raw.slice(-4)}`;
}

export function orderRefFromRow(row: VendorSettlementRow): string {
  const md = metaRecord(row.metadata);
  return (
    (typeof md.orderRef === "string" && md.orderRef) ||
    (typeof md.order_ref === "string" && md.order_ref) ||
    (row.orderId ? `Order #${row.orderId.slice(0, 8)}` : "-")
  );
}

export function formatShortDate(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "numeric", year: "numeric" });
}

/** e.g. "7 May 2026" for list rows */
export function formatListDayMonthYear(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "settled" || s === "completed" || s === "paid") return "bg-success/10 text-success";
  if (s === "rejected" || s === "failed") return "bg-destructive/10 text-destructive";
  return "bg-warning/10 text-warning ring-1 ring-warning/20";
}

export function parseAmount(s: string): number {
  const n = parseFloat(s || "0");
  return Number.isFinite(n) ? n : 0;
}

export function grossAndCommission(row: VendorSettlementRow): { gross: string; commission: string } {
  const md = metaRecord(row.metadata);
  const gross =
    md.vendorSubtotal != null
      ? String(md.vendorSubtotal)
      : md.gross != null
        ? String(md.gross)
        : row.amount;
  const commission =
    md.commissionTotal != null ? String(md.commissionTotal) : md.commission != null ? String(md.commission) : "0";
  return { gross, commission };
}
function bookingDisplayName(row: VendorBookingRow): string {
  const md = metaRecord(row.metadata);
  return (
    (typeof md.serviceName === "string" && md.serviceName.trim()) ||
    (typeof md.catalogName === "string" && md.catalogName.trim()) ||
    "Service booking"
  );
}

function settlementBookingId(row: VendorSettlementRow): string {
  const md = metaRecord(row.metadata);
  return (
    (typeof md.bookingId === "string" && md.bookingId.trim()) ||
    (typeof md.booking_id === "string" && md.booking_id.trim()) ||
    (typeof md.serviceBookingId === "string" && md.serviceBookingId.trim()) ||
    ""
  );
}

export function completedBookingsAsPendingSettlements(
  bookings: VendorBookingRow[],
  existingRows: VendorSettlementRow[] = [],
): VendorSettlementRow[] {
  const settledBookingIds = new Set(existingRows.map(settlementBookingId).filter(Boolean));

  return bookings
    .filter((booking) => String(booking.status || "").toLowerCase() === "completed")
    .filter((booking) => !settledBookingIds.has(booking.id))
    .map((booking) => {
      const serviceName = bookingDisplayName(booking);
      const createdAt = booking.updatedAt || booking.createdAt || booking.bookingDate;
      return {
        id: `service-booking-${booking.id}`,
        vendorId: booking.vendorId,
        orderId: booking.id,
        settlementType: "service_booking",
        status: "pending",
        amount: String(booking.totalAmount ?? "0"),
        metadata: {
          source: "service_booking",
          bookingId: booking.id,
          displayRef: `BKG-${booking.id.slice(0, 8).toUpperCase()}`,
          orderRef: `${serviceName} booking`,
          serviceName,
          bookingDate: booking.bookingDate,
          timeSlot: booking.timeSlot,
          gross: String(booking.totalAmount ?? "0"),
          commission: "0",
        },
        createdAt,
        updatedAt: booking.updatedAt || createdAt,
      };
    });
}
