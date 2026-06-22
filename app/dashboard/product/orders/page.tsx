"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  Package,
  Pencil,
  Truck,
} from "lucide-react";
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
  statusBadgeClass,
} from "@/components/vendor/orders/OrderDetailModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

type StatCard = {
  label: string;
  value: string;
  icon: typeof Clock3;
  iconClass: string;
  valueClass?: string;
};

export default function VendorProductOrdersPage() {
  const [me, setMe] = useState<VendorProfile | null>(null);
  const [items, setItems] = useState<VendorCommerceOrder[]>([]);
  const [total, setTotal] = useState(0);
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
      setTotal(list.total ?? list.items?.length ?? 0);
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

  const statCards: StatCard[] = useMemo(
    () => [
      {
        label: "Today",
        value: String(stats.today),
        icon: Clock3,
        iconClass: "bg-primary/10 text-primary",
      },
      {
        label: "Pending",
        value: String(stats.pending),
        icon: Package,
        iconClass: "bg-warning/10 text-warning",
        valueClass: "text-warning",
      },
      {
        label: "Active",
        value: String(stats.active),
        icon: Truck,
        iconClass: "bg-info/10 text-info",
        valueClass: "text-info",
      },
      {
        label: "Revenue",
        value: formatInr(stats.revenue),
        icon: CheckCircle2,
        iconClass: "bg-success/10 text-success",
        valueClass: "text-success text-2xl",
      },
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

  function closeDetail() {
    setDetail(null);
  }

  function onOrderUpdated(updated: VendorCommerceOrder) {
    setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  const canUpdateStatus = (o: VendorCommerceOrder) => {
    const s = o.status.toLowerCase();
    return !["completed", "delivered", "cancelled", "refunded"].includes(s);
  };

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Manage and track your storefront orders.
          {total > 0 ? (
            <span className="ml-1 font-medium text-foreground" aria-live="polite">
              ({total} {total === 1 ? "order" : "orders"} on file)
            </span>
          ) : null}
        </p>
      </div>

      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : statCards.map((s) => (
              <Card key={s.label} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                    <p className={cn("mt-2 text-3xl font-bold tracking-tight text-foreground", s.valueClass)}>
                      {s.value}
                    </p>
                  </div>
                  <div className={cn("rounded-xl p-2.5", s.iconClass)}>
                    <s.icon className="h-6 w-6" aria-hidden />
                  </div>
                </div>
              </Card>
            ))}
      </div>

      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-muted/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              tab === t.key
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ul className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <Card className="p-14 text-center text-muted-foreground">No orders in this view yet.</Card>
      ) : (
        <ul className="space-y-4">
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
            const media = (u: string) => {
              if (!u) return "";
              if (/^https?:\/\//i.test(u)) return u;
              const base = (process.env.NEXT_PUBLIC_API_GATEWAY_URL || "").replace(/\/$/, "");
              if (base) return `${base}${u.startsWith("/") ? u : `/${u}`}`;
              return u;
            };

            return (
              <li key={o.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground sm:text-base">
                          {displayOrderRef(o)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                            statusBadgeClass(o.status),
                          )}
                        >
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {customerName(m)} · {formatListDate(o.createdAt)}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-foreground">{formatInr(o.totalAmount)}</p>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={media(String(thumb))} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                          No image
                        </div>
                      )}
                    </div>
                    <p className="min-w-0 flex-1 text-sm font-medium text-foreground sm:text-base">
                      {lines.length ? (
                        <>
                          {String(title)} x {qty}
                        </>
                      ) : (
                        <span className="text-muted-foreground">No line items (metadata)</span>
                      )}
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => openDetail(o)} className="gap-2">
                      <Eye className="h-4 w-4" aria-hidden />
                      View
                    </Button>
                    {canUpdateStatus(o) ? (
                      <Button type="button" onClick={() => openDetail(o)} className="gap-2">
                        <Pencil className="h-4 w-4" aria-hidden />
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
          onClose={closeDetail}
          onUpdated={onOrderUpdated}
        />
      ) : null}
    </div>
  );
}
