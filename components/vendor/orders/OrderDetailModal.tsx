"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Package, Pencil, ShoppingCart, User, X } from "lucide-react";
import type { VendorCommerceOrder } from "@/lib/api/vendorOrders";
import { vendorOrdersApi } from "@/lib/api/vendorOrders";
import { resolveMediaUrl } from "@/lib/media";

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
  return resolveMediaUrl(u) || u;
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
  if (s === "completed" || s === "delivered") return "bg-success/10 text-success";
  if (s === "cancelled" || s === "refunded") return "bg-destructive/10 text-destructive";
  if (s === "placed" || s === "created" || s === "pending" || s === "new" || s === "paid")
    return "bg-primary/10 text-primary ring-1 ring-primary/20";
  return "bg-info/10 text-info";
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
  const [shippingType, setShippingType] = useState("own");
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  useEffect(() => {
    setLocal(order);
    setStatusDraft(order?.status ?? "");
    setErr("");
    const m = metaRecord(order?.metadata);
    setShippingType(String(m.shipping_type || m.shippingType || "own"));
    setCourierName(String(m.courier_name || m.courierName || ""));
    setTrackingNumber(String(m.tracking_number || m.trackingNumber || ""));
    setTrackingUrl(String(m.tracking_url || m.trackingUrl || ""));
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
      if (statusDraft === "shipped" && shippingType === "courier" && (!courierName.trim() || !trackingNumber.trim())) { throw new Error("Courier name and tracking number are required."); }
      const metadata = statusDraft === "shipped" ? { ...meta, shipping_type: shippingType, courier_name: courierName.trim(), tracking_number: trackingNumber.trim(), tracking_url: trackingUrl.trim() } : meta;
      const updated = await vendorOrdersApi.patch(local.id, { status: statusDraft, metadata });
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

  async function updateReturn(action: "approve" | "reject" | "received") {
    if (!local) return;
    const note = window.prompt(`Optional note for ${action}:`) || undefined;
    setSaving(true); setErr("");
    try {
      const updated = await vendorOrdersApi.updateReturn(local.id, action, note);
      setLocal(updated); onUpdated(updated);
    } catch (e: any) { setErr(e?.message || "Return update failed"); }
    finally { setSaving(false); }
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
        className="flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingCart className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="order-detail-title" className="truncate text-lg font-bold text-foreground sm:text-xl">
                {refLabel}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{formatDateTime(local.createdAt)}</p>
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
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
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
                    i < filled ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-0.5 text-[10px] font-medium sm:text-xs">
              {FLOW_LABELS.map((label) => (
                <div key={label} className="flex-1 text-center leading-tight text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/50 px-4 py-3 ring-1 ring-border">
              <div className="flex items-center gap-2 text-primary">
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium text-muted-foreground">Customer</span>
              </div>
              <p className="mt-1 text-base font-semibold text-foreground">{customerName(meta)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-4 py-3 ring-1 ring-border">
              <div className="flex items-center gap-2 text-info">
                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-xs font-medium text-muted-foreground">Vendor</span>
              </div>
              <p className="mt-1 text-base font-semibold text-foreground">{vendorDisplayName}</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-foreground">
              <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span className="text-sm font-semibold">Order Items</span>
            </div>
            <div className="space-y-2">
              {lines.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No line items on this order yet. They appear when checkout stores `metadata.items`.
                </p>
              ) : (
                lines.map((line, idx) => {
                  const thumb = orderLineThumbnailRaw(line);
                  return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-3"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(thumb)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{lineTitle(line)}</p>
                      <p className="text-sm text-muted-foreground">Qty: {lineQty(line)}</p>
                    </div>
                    <p className="shrink-0 text-base font-bold text-foreground">
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
            <div className="mb-6 rounded-xl bg-muted/50 px-4 py-4 ring-1 ring-border">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Item Total (MRP)</span>
                <span className="font-medium text-foreground">{formatInr(totals.item)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                <span>Platform Fee</span>
                <span className="font-medium text-foreground">{formatInr(totals.platform)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                <span>GST on Platform Fee (18%)</span>
                <span className="font-medium text-foreground">{formatInr(totals.gst)}</span>
              </div>
              <div className="my-3 border-t border-border" />
              <div className="flex justify-between text-base font-bold text-foreground">
                <span>Grand Total</span>
                <span>{formatInr(totals.grand)}</span>
              </div>
              {(paymentRef || gatewayId) && (
                <>
                  <div className="my-4 border-t border-border" />
                  {paymentRef ? (
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>Payment Ref ID</span>
                      <span className="max-w-[60%] truncate font-mono text-foreground">{paymentRef}</span>
                    </div>
                  ) : null}
                  {gatewayId ? (
                    <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>Gateway Order ID</span>
                      <span className="max-w-[60%] truncate font-mono text-foreground">{gatewayId}</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {!readOnly ? (
            <div className="rounded-xl border border-border bg-card px-4 py-4">
              <label className="text-sm font-medium text-muted-foreground">Update Order Status</label>
              <select
                className="input mt-2 w-full border-primary/40 py-3 text-base font-medium text-foreground focus:border-primary"
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              {statusDraft === "shipped" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm"><span>Shipping type</span><select className="input mt-1 w-full" value={shippingType} onChange={(e) => setShippingType(e.target.value)}><option value="own">Own delivery</option><option value="courier">Courier</option></select></label>
                  {shippingType === "courier" ? <><label className="text-sm"><span>Courier name</span><input className="input mt-1 w-full" value={courierName} onChange={(e) => setCourierName(e.target.value)} required /></label><label className="text-sm"><span>Tracking / AWB</span><input className="input mt-1 w-full" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} required /></label><label className="text-sm"><span>Tracking URL</span><input className="input mt-1 w-full" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} /></label></> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {meta.returnRequest && typeof meta.returnRequest === "object" ? (() => {
            const request = meta.returnRequest as Record<string, unknown>;
            const status = String(request.status || "requested");
            return <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-semibold text-amber-950">Customer return request</h3><p className="mt-1 text-sm text-amber-900">{String(request.reason || "No reason provided")}</p><p className="mt-2 text-xs font-semibold uppercase text-amber-800">Status: {status.replace(/_/g, " ")}</p><div className="mt-3 flex flex-wrap gap-2">{status === "requested" ? <><button type="button" disabled={saving} onClick={() => void updateReturn("approve")} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Approve</button><button type="button" disabled={saving} onClick={() => void updateReturn("reject")} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">Reject</button></> : null}{status === "approved" ? <button type="button" disabled={saving} onClick={() => void updateReturn("received")} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Mark return received</button> : null}</div></div>;
          })() : null}
          {err ? <p className="mt-3 text-sm text-destructive">{err}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Close
          </button>
          {!readOnly ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveStatus()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
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
