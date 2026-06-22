import type { VendorBookingRow } from "@/lib/api/vendorBookings";
import type { VendorCommerceOrder } from "@/lib/api/vendorOrders";
import type { OrderRow } from "@/components/vendor/VendorDashboardUi";
import { customerName, displayOrderRef, metaRecord } from "@/components/vendor/orders/OrderDetailModal";
import { formatInr } from "@/lib/vendor/settlementDisplay";

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function startOfWeekMonday(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Mon–Sun of the current calendar week; revenue sums `amount` for rows whose `getYmd` falls on that day. */
export function buildWeekRevenueSeries<T>(
  rows: T[],
  getYmd: (row: T) => string | null,
  getAmount: (row: T) => number,
): { day: string; revenue: number }[] {
  const start = startOfWeekMonday(new Date());
  return WEEK_LABELS.map((label, i) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + i);
    const key = ymdLocal(dayDate);
    let sum = 0;
    for (const row of rows) {
      const rk = getYmd(row);
      if (rk === key) sum += getAmount(row);
    }
    return { day: label, revenue: Math.round(sum * 100) / 100 };
  });
}

export function orderYmd(o: VendorCommerceOrder): string | null {
  if (!o.createdAt) return null;
  const d = new Date(o.createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return ymdLocal(d);
}

export function orderAmount(o: VendorCommerceOrder): number {
  const n = parseFloat(String(o.totalAmount ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

export function bookingYmd(b: VendorBookingRow): string | null {
  if (b.createdAt) {
    const d = new Date(b.createdAt);
    if (!Number.isNaN(d.getTime())) return ymdLocal(d);
  }
  const raw = String(b.bookingDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

export function bookingAmount(b: VendorBookingRow): number {
  const n = parseFloat(String(b.totalAmount ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

const NEW_STATUSES = new Set(["placed", "created", "pending", "paid", "new"]);
const ACTIVE_STATUSES = new Set([
  "accepted",
  "in_progress",
  "processing",
  "shipped",
  "packed",
  "out_for_delivery",
]);

export function countActiveOrders(orders: VendorCommerceOrder[]): number {
  return orders.filter((o) => ACTIVE_STATUSES.has(String(o.status || "").toLowerCase())).length;
}

export function countNewOrders(orders: VendorCommerceOrder[]): number {
  return orders.filter((o) => NEW_STATUSES.has(String(o.status || "").toLowerCase())).length;
}

export function sumOrderRevenue(orders: VendorCommerceOrder[]): number {
  return orders.reduce((acc, o) => acc + orderAmount(o), 0);
}

export function orderToRecentRow(o: VendorCommerceOrder): OrderRow {
  const m = metaRecord(o.metadata);
  const st = String(o.status || "").toLowerCase();
  let tone: OrderRow["statusTone"] = "neutral";
  if (st === "cancelled" || st === "refunded") tone = "danger";
  else if (st === "delivered" || st === "completed") tone = "success";
  else if (NEW_STATUSES.has(st) || ACTIVE_STATUSES.has(st)) tone = "info";
  return {
    id: displayOrderRef(o),
    customer: customerName(m),
    amount: formatInr(o.totalAmount ?? "0"),
    status: st.replace(/_/g, " ") || "—",
    statusTone: tone,
  };
}

function bookingCustomerLabel(b: VendorBookingRow): string {
  const m = b.metadata;
  if (m && typeof m === "object") {
    const o = m as Record<string, unknown>;
    const n =
      (typeof o.customerName === "string" && o.customerName.trim()) ||
      (typeof o.fullName === "string" && o.fullName.trim());
    if (n) return n;
  }
  const id = String(b.customerId || "").trim();
  if (id.length >= 8) return `Customer · ${id.slice(0, 8)}…`;
  return id || "Customer";
}

function bookingStatusTone(st: string): OrderRow["statusTone"] {
  const s = st.toLowerCase();
  if (s === "rejected" || s === "cancelled") return "danger";
  if (s === "approved" || s === "completed") return "success";
  if (s === "pending") return "info";
  return "neutral";
}

export function bookingToRecentRow(b: VendorBookingRow): OrderRow {
  const st = String(b.status || "pending").toLowerCase();
  return {
    id: `BKG-${String(b.id).slice(0, 8).toUpperCase()}`,
    customer: bookingCustomerLabel(b),
    amount: formatInr(b.totalAmount ?? "0"),
    status: st,
    statusTone: bookingStatusTone(st),
  };
}
