"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Package, Pencil, ShoppingCart, User, X } from "lucide-react";
import type { VendorCommerceOrder } from "@/lib/api/vendorOrders";
import { vendorOrdersApi } from "@/lib/api/vendorOrders";

const FLOW = [
  "placed",
  "paid",
  "accepted",
  "in_progress",
  "shipped",
  "delivered",
  "completed",
] as const;

const FLOW_LABELS = [
  "Placed",
  "Paid",
  "Accepted",
  "In Progress",
  "Shipped",
  "Delivered",
  "Completed",
] as const;

const STATUS_OPTIONS = [
  "placed",
  "paid",
  "accepted",
  "in_progress",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
] as const;

export function metaRecord(m: unknown): Record<string, unknown> {
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  return m as Record<string, unknown>;
}

export function displayOrderRef(o: VendorCommerceOrder): string {
  const m = metaRecord(o.metadata);
  const human = typeof m.displayId === "string" && m.displayId.trim() ? m.displayId.trim() : "";
  if (human) return human;
  if (o.orderRef && String(o.orderRef).trim()) return String(o.orderRef).trim();
  return o.id;
}

export function customerName(meta: Record<string, unknown>): string {
  if (typeof meta.customerName === "string" && meta.customerName.trim()) return meta.customerName.trim();
  const c = meta.customer;
  if (c && typeof c === "object" && !Array.isArray(c)) {
    const o = c as Record<string, unknown>;
    const n =
      (typeof o.name === "string" && o.name) ||
      (typeof o.fullName === "string" && o.fullName) ||
      "";
    if (String(n).trim()) return String(n).trim();
  }
  return "Customer";
}

export function orderLines(meta: Record<string, unknown>) {
  const raw = meta.items ?? meta.lines;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
}

function lineTitle(line: Record<string, unknown>): string {
  return (
    (typeof line.name === "string" && line.name) ||
    (typeof line.productName === "string" && line.productName) ||
    (typeof line.title === "string" && line.title) ||
    "Item"
  );
}

function lineQty(line: Record<string, unknown>): number {
  const q = line.quantity ?? line.qty;
  if (typeof q === "number" && Number.isFinite(q)) return q;
  if (typeof q === "string" && q.trim()) return parseInt(q, 10) || 1;
  return 1;
}

function nonEmptyStr(v: unknown): string {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Raw path/URL for a commerce order line (cart metadata is often nested under `metadata`). */
export function orderLineThumbnailRaw(line: Record<string, unknown>): string {
  const nested = metaRecord(line.metadata);
  return (
    nonEmptyStr(line.thumbnailUrl) ||
    nonEmptyStr(line.imageUrl) ||
    nonEmptyStr(line.productImage) ||
    nonEmptyStr(line.image) ||
    nonEmptyStr(line.thumbnail) ||
    nonEmptyStr(nested.productImage) ||
    nonEmptyStr(nested.thumbnailUrl) ||
    nonEmptyStr(nested.imageUrl) ||
    nonEmptyStr(nested.image) ||
    nonEmptyStr(nested.thumbnail) ||
    ""
  );
}

function mediaUrl(u: string) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY_URL || "").replace(/\/$/, "");
  if (base) return `${base}${u.startsWith("/") ? u : `/${u}`}`;
  return u;
}

function filledSegments(statusRaw: string): number {
  const s = statusRaw.toLowerCase().replace(/\s+/g, "_");
  if (s === "cancelled" || s === "refunded") return 0;
  const idx = (FLOW as readonly string[]).indexOf(s);
  if (idx >= 0) return idx + 1;
  if (s === "created" || s === "pending" || s === "new") return 1;
  return 1;
}

export function formatInr(amount: string | number): string {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount || "0"));
  if (!Number.isFinite(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function totalsFromOrder(o: VendorCommerceOrder) {
  const m = metaRecord(o.metadata);
  const t =
    m.totals && typeof m.totals === "object" && !Array.isArray(m.totals)
      ? (m.totals as Record<string, unknown>)
      : {};
  const item = t.itemTotal ?? t.itemSubtotal ?? t.subtotal ?? o.totalAmount;
  const platform = t.platformFee ?? t.platform_fee ?? 0;
  const gst = t.gstOnPlatformFee ?? t.gst_on_platform ?? t.gst ?? 0;
  const grand = t.grandTotal ?? t.grand_total ?? o.totalAmount;
  return {
    item: String(item ?? "0"),
    platform: String(platform ?? "0"),
    gst: String(gst ?? "0"),
    grand: String(grand ?? o.totalAmount ?? "0"),
  };
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "completed" || s === "delivered") return "bg-emerald-100 text-emerald-800";
  if (s === "cancelled" || s === "refunded") return "bg-rose-100 text-rose-800";
  if (s === "placed" || s === "created" || s === "pending" || s === "new")
    return "bg-teal-50 text-teal-800 ring-1 ring-teal-200/80";
  return "bg-sky-100 text-sky-800";
}

export function OrderDetailModal({
  order,
  vendorDisplayName,
  onClose,
  onUpdated,
}: {
  order: VendorCommerceOrder | null;
  vendorDisplayName: string;
  onClose: () => void;
  onUpdated: (o: VendorCommerceOrder) => void;
}) {
  const [local, setLocal] = useState<VendorCommerceOrder | null>(order);
  const [statusDraft, setStatusDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLocal(order);
    setStatusDraft(order?.status ?? "");
    setErr("");
  }, [order]);

  const meta = useMemo(() => metaRecord(local?.metadata), [local]);
  const lines = useMemo(() => orderLines(meta), [meta]);
  const totals = useMemo(() => (local ? totalsFromOrder(local) : null), [local]);
  const filled = local ? filledSegments(local.status) : 0;
  const paymentRef =
    (typeof meta.paymentRefId === "string" && meta.paymentRefId) ||
    (typeof meta.payment_ref === "string" && meta.payment_ref) ||
    "";
  const gatewayId =
    (typeof meta.gatewayOrderId === "string" && meta.gatewayOrderId) ||
    (typeof meta.gateway_order_id === "string" && meta.gateway_order_id) ||
    "";

  const readOnly =
    local &&
    ["completed", "delivered", "cancelled", "refunded"].includes(local.status.toLowerCase());

  async function saveStatus() {
    if (!local || !statusDraft || statusDraft === local.status) {
      onClose();
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const updated = await vendorOrdersApi.patch(local.id, { status: statusDraft });
      setLocal(updated);
      onUpdated(updated);
      onClose();
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Save failed",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!local) return null;

  const refLabel = displayOrderRef(local);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#20a090] text-white">
              <ShoppingCart className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="order-detail-title" className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                {refLabel}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">{formatDateTime(local.createdAt)}</p>
              <span
                className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(local.status)}`}
              >
                {local.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mb-6">
            <div className="flex gap-0.5">
              {FLOW_LABELS.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-sm first:rounded-l-md last:rounded-r-md ${
                    i < filled ? "bg-[#20a090]" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-0.5 text-[10px] font-medium sm:text-xs">
              {FLOW_LABELS.map((label) => (
                <div key={label} className="flex-1 text-center leading-tight text-slate-500">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50/90 px-4 py-3 ring-1 ring-slate-100">
              <div className="flex items-center gap-2 text-[#20a090]">
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium text-slate-500">Customer</span>
              </div>
              <p className="mt-1 text-base font-semibold text-slate-900">{customerName(meta)}</p>
            </div>
            <div className="rounded-xl bg-slate-50/90 px-4 py-3 ring-1 ring-slate-100">
              <div className="flex items-center gap-2 text-sky-600">
                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium text-slate-500">Vendor</span>
              </div>
              <p className="mt-1 text-base font-semibold text-slate-900">{vendorDisplayName}</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-slate-900">
              <Package className="h-4 w-4 text-slate-600" aria-hidden />
              <span className="text-sm font-semibold">Order Items</span>
            </div>
            <div className="space-y-2">
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
                  No line items on this order yet. They appear when checkout stores `metadata.items`.
                </p>
              ) : (
                lines.map((line, idx) => {
                  const thumb = orderLineThumbnailRaw(line);
                  return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-200 ring-1 ring-slate-200">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(thumb)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{lineTitle(line)}</p>
                      <p className="text-sm text-slate-500">Qty: {lineQty(line)}</p>
                    </div>
                    <p className="shrink-0 text-base font-bold text-slate-900">
                      {formatInr(
                        (line.lineTotal as string | undefined) ||
                          (line.unitPrice as string | undefined) ||
                          totals?.item ||
                          "0",
                      )}
                    </p>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          {totals ? (
            <div className="mb-6 rounded-xl bg-slate-50 px-4 py-4 ring-1 ring-slate-100">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Item Total (MRP)</span>
                <span className="font-medium text-slate-900">{formatInr(totals.item)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-slate-600">
                <span>Platform Fee</span>
                <span className="font-medium text-slate-900">{formatInr(totals.platform)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-slate-600">
                <span>GST on Platform Fee (18%)</span>
                <span className="font-medium text-slate-900">{formatInr(totals.gst)}</span>
              </div>
              <div className="my-3 border-t border-slate-200" />
              <div className="flex justify-between text-base font-bold text-slate-900">
                <span>Grand Total</span>
                <span>{formatInr(totals.grand)}</span>
              </div>
              {(paymentRef || gatewayId) && (
                <>
                  <div className="my-4 border-t border-slate-200" />
                  {paymentRef ? (
                    <div className="flex justify-between gap-2 text-xs text-slate-600">
                      <span>Payment Ref ID</span>
                      <span className="max-w-[60%] truncate font-mono text-slate-800">{paymentRef}</span>
                    </div>
                  ) : null}
                  {gatewayId ? (
                    <div className="mt-2 flex justify-between gap-2 text-xs text-slate-600">
                      <span>Gateway Order ID</span>
                      <span className="max-w-[60%] truncate font-mono text-slate-800">{gatewayId}</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {!readOnly ? (
            <div className="rounded-xl border border-slate-100 bg-white px-4 py-4">
              <label className="text-sm font-medium text-slate-600">Update Order Status</label>
              <select
                className="input mt-2 w-full border-[#20a090]/40 py-3 text-base font-medium text-slate-900 focus:border-[#20a090]"
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Close
          </button>
          {!readOnly ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveStatus()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#20a090] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#188a7c] disabled:opacity-60"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {saving ? "Saving…" : "Save changes"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
