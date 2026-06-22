"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  DollarSign,
  History,
  Package,
  ShieldCheck,
  ShoppingCart,
  Star,
} from "lucide-react";
import {
  VendorQuickActionStrip,
  VendorRecentOrdersCard,
  VendorRevenueAreaChart,
  VendorStatRow,
  type StatItem,
} from "@/components/vendor/VendorDashboardUi";
import { Skeleton } from "@/components/ui/skeleton";
import { vendorOrdersApi } from "@/lib/api/vendorOrders";
import { vendorCatalogApi } from "@/lib/api/vendorCatalog";
import { vendorRatingsApi } from "@/lib/api/vendorRatings";
import { formatInr } from "@/lib/vendor/settlementDisplay";
import {
  buildWeekRevenueSeries,
  countActiveOrders,
  countNewOrders,
  orderAmount,
  orderToRecentRow,
  orderYmd,
  sumOrderRevenue,
} from "@/lib/vendor/dashboardMetrics";

export default function ProductVendorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);
  const [productTotal, setProductTotal] = useState(0);
  const [ratingSummary, setRatingSummary] = useState<{ averageRating: number; reviewCount: number } | null>(null);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof vendorOrdersApi.list>>["items"]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [ordersRes, productsRes, ratingsRes] = await Promise.all([
        vendorOrdersApi.list({ limit: 100, offset: 0 }),
        vendorCatalogApi.listProducts({ limit: 1, offset: 0, moderation: "all" }),
        vendorRatingsApi.getSummary().catch(() => null),
      ]);
      setOrderTotal(ordersRes.total ?? ordersRes.items?.length ?? 0);
      setProductTotal(productsRes.total ?? 0);
      setRatingSummary(ratingsRes);
      setOrders(ordersRes.items || []);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load dashboard");
      setOrders([]);
      setOrderTotal(0);
      setProductTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const weekRevenue = useMemo(
    () => buildWeekRevenueSeries(orders, orderYmd, orderAmount),
    [orders],
  );

  const stats: StatItem[] = useMemo(() => {
    const revenue = sumOrderRevenue(orders);
    const active = countActiveOrders(orders);
    const newCt = countNewOrders(orders);
    const pipeline = active + newCt;
    return [
      {
        title: "Total revenue",
        value: formatInr(revenue),
        hint: `${orderTotal} order${orderTotal === 1 ? "" : "s"} on record`,
        hintPositive: true,
        icon: DollarSign,
      },
      {
        title: "Active orders",
        value: String(pipeline),
        hint: "In progress or awaiting fulfilment",
        hintPositive: true,
        icon: ShoppingCart,
      },
      {
        title: "Products",
        value: String(productTotal),
        icon: Package,
      },
      {
        title: "Store rating",
        value: ratingSummary && ratingSummary.reviewCount > 0 ? String(ratingSummary.averageRating) : "—",
        hint:
          ratingSummary && ratingSummary.reviewCount > 0
            ? `${ratingSummary.reviewCount} review${ratingSummary.reviewCount === 1 ? "" : "s"}`
            : "No ratings yet",
        icon: Star,
      },
    ];
  }, [orders, orderTotal, productTotal, ratingSummary]);

  const recentRows = useMemo(() => orders.slice(0, 5).map(orderToRecentRow), [orders]);

  if (loading) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-[300px] rounded-2xl lg:col-span-3" />
          <Skeleton className="h-[300px] rounded-2xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      {err ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground" role="status">
          {err}
        </div>
      ) : null}

      <VendorStatRow items={stats} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <VendorRevenueAreaChart data={weekRevenue} gradientId="prdDashRev" />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <VendorRecentOrdersCard viewAllHref="/dashboard/product/orders" orders={recentRows} />
        </div>
      </div>

      <section aria-label="Quick actions">
        <VendorQuickActionStrip
          items={[
            { icon: Package, href: "/dashboard/product/products", label: "Products" },
            { icon: ShoppingCart, href: "/dashboard/product/orders", label: "Orders" },
            { icon: DollarSign, href: "/dashboard/product/settlements", label: "Settlements" },
            { icon: History, href: "/dashboard/product/payments", label: "Payment History" },
            { icon: CreditCard, href: "/dashboard/product/bank", label: "Bank Account" },
            { icon: ShieldCheck, href: "/dashboard/product/kyc", label: "KYC Verification" },
          ]}
        />
      </section>
    </div>
  );
}
