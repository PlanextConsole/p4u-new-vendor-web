"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Eye, Package, Pencil, Truck } from "lucide-react";
import type { VendorCommerceOrder } from "@/lib/api/vendorOrders";
import { vendorOrdersApi } from "@/lib/api/vendorOrders";
import { getVendorMe, type VendorProfile } from "@/lib/api/vendor";
import {
  OrderDetailModal,
  customerName,
  displayOrderRef,
  formatInr,
  metaRecord,
  orderLineThumbnailRaw,
  orderLines,
} from "@/components/vendor/orders/OrderDetailModal";
import {
  VendorListEmpty,
  VendorListLayout,
  VendorListStatRow,
  VendorListTabs,
  VendorStatusBadge,
} from "@/components/vendor/VendorListUi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveMediaUrl } from "@/lib/media";

type TabKey = "all" | "new" | "active" | "done";

const NEW_STATUSES = new Set(["placed", "created", "pending", "paid", "new"]);
const ACTIVE_STATUSES = new Set([
  "accepted",
  "in_progress",
  "processing",
  "shipped",
  "packed",
  "out_for_delivery",
]);
const DONE_STATUSES = new Set(["completed", "delivered", "cancelled", "refunded"]);

function bucket(tab: TabKey, status: string): boolean {
  const s = status.toLowerCase();
  if (tab === "all") return true;
  if (tab === "new") return NEW_STATUSES.has(s);
  if (tab === "active") return ACTIVE_STATUSES.has(s);
  if (tab === "done") return DONE_STATUSES.has(s);
  return true;
}

function countTab(items: VendorCommerceOrder[], tab: TabKey): number {
  return items.filter((o) => bucket(tab, o.status)).length;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseCreatedMs(iso?: string): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatListDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function mediaUrl(u: string) {
  return resolveMediaUrl(u) || u;
}

export default function VendorProductOrdersPage() {
  const [me, setMe] = useState<VendorProfile | null>(null);
  const [items, setItems] = useState<VendorCommerceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [detail, setDetail] = useState<VendorCommerceOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [profile, list] = await Promise.all([
        getVendorMe(),
        vendorOrdersApi.list({ limit: 100, offset: 0 }),
      ]);
      setMe(profile);
      setItems(list.items || []);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const vendorName = me?.businessName || me?.ownerName || "Vendor";

  const stats = useMemo(() => {
    const t0 = startOfToday();
    let today = 0;
    let pending = 0;
    let active = 0;
    let revenue = 0;
    for (const o of items) {
      const ms = parseCreatedMs(o.createdAt);
      if (ms >= t0) today += 1;
      if (NEW_STATUSES.has(o.status.toLowerCase())) pending += 1;
      if (ACTIVE_STATUSES.has(o.status.toLowerCase())) active += 1;
      const s = o.status.toLowerCase();
      if (s === "completed" || s === "delivered") {
        revenue += parseFloat(o.totalAmount || "0") || 0;
      }
    }
    return { today, pending, active, revenue };
  }, [items]);

  const statCards = useMemo(
    () => [
      { label: "Today", value: String(stats.today), icon: Clock3, iconClass: "text-primary" },
      { label: "Pending", value: String(stats.pending), icon: Package, iconClass: "text-warning", valueClass: "text-warning" },
      { label: "Active", value: String(stats.active), icon: Truck, iconClass: "text-info", valueClass: "text-info" },
      { label: "Revenue", value: formatInr(stats.revenue), icon: CheckCircle2, iconClass: "text-success", valueClass: "text-success" },
    ],
    [stats],
  );

  const filtered = useMemo(() => items.filter((o) => bucket(tab, o.status)), [items, tab]);

  const tabs: { key: TabKey; label: string }[] = useMemo(
    () => [
      { key: "all", label: `All (${countTab(items, "all")})` },
      { key: "new", label: `New (${countTab(items, "new")})` },
      { key: "active", label: `Active (${countTab(items, "active")})` },
      { key: "done", label: `Done (${countTab(items, "done")})` },
    ],
    [items],
  );

  async function openDetail(o: VendorCommerceOrder) {
    try {
      const fresh = await vendorOrdersApi.get(o.id);
      setDetail(fresh);
    } catch {
      setDetail(o);
    }
  }

  function onOrderUpdated(updated: VendorCommerceOrder) {
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  const canUpdateStatus = (o: VendorCommerceOrder) => {
    const s = o.status.toLowerCase();
    return !["completed", "delivered", "cancelled", "refunded"].includes(s);
  };

  return (
    <VendorListLayout>
      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <VendorListStatRow items={statCards} />
      )}

      <VendorListTabs tabs={tabs} active={tab} onChange={setTab} />

      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <VendorListEmpty
          icon={Package}
          title="No orders yet"
          subtitle="Orders placed by customers will appear here"
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => {
            const m = metaRecord(o.metadata);
            const lines = orderLines(m);
            const first = lines[0];
            const thumb = first ? orderLineThumbnailRaw(first) : "";
            const title =
              first &&
              ((typeof first.name === "string" && first.name) ||
                (typeof first.productName === "string" && first.productName) ||
                "Product");
            const qty =
              first &&
              (typeof first.quantity === "number"
                ? first.quantity
                : typeof first.qty === "number"
                  ? first.qty
                  : 1);

            return (
              <li key={o.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{displayOrderRef(o)}</span>
                        <VendorStatusBadge status={o.status} kind="order" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {customerName(m)} · {formatListDate(o.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm font-bold">{formatInr(o.totalAmount)}</p>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded bg-muted">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(String(thumb))} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <p className="min-w-0 flex-1 text-xs font-medium">
                      {lines.length ? (
                        <>
                          {String(title)} x {qty}
                        </>
                      ) : (
                        <span className="text-muted-foreground">No line items</span>
                      )}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => openDetail(o)}>
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    {canUpdateStatus(o) ? (
                      <Button type="button" size="sm" className="h-8 gap-1 text-xs" onClick={() => openDetail(o)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Update Status
                      </Button>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {detail ? (
        <OrderDetailModal
          order={detail}
          vendorDisplayName={vendorName}
          onClose={() => setDetail(null)}
          onUpdated={onOrderUpdated}
        />
      ) : null}
    </VendorListLayout>
  );
}
