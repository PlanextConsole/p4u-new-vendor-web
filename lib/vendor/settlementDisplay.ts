import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";

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
    (row.orderId ? `Order #${row.orderId.slice(0, 8)}` : "—")
  );
}

export function formatShortDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "numeric", year: "numeric" });
}

/** e.g. "7 May 2026" for list rows */
export function formatListDayMonthYear(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "settled" || s === "completed" || s === "paid") return "bg-emerald-100 text-emerald-800";
  if (s === "rejected" || s === "failed") return "bg-rose-100 text-rose-800";
  return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
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
