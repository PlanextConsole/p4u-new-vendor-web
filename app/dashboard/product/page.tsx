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
  VendorDashboardChartRowSkeleton,
  VendorDashboardLayout,
  VendorQuickActionStrip,
  VendorRecentOrdersCard,
  VendorRevenueAreaChart,
  VendorStatRow,
  VendorStatRowSkeleton,
  type StatItem,
} from "@/components/vendor/VendorDashboardUi";
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
        title: "Total Revenue",
        value: formatInr(revenue),
        hint: `${orderTotal} orders`,
        hintPositive: true,
        icon: DollarSign,
      },
      {
        title: "Active Orders",
        value: String(pipeline),
        icon: ShoppingCart,
      },
      {
        title: "Products",
        value: String(productTotal),
        icon: Package,
      },
      {
        title: "Rating",
        value: ratingSummary && ratingSummary.reviewCount > 0 ? String(ratingSummary.averageRating) : "—",
        hint:
          ratingSummary && ratingSummary.reviewCount > 0
            ? `${ratingSummary.reviewCount} total orders`
            : undefined,
        hintPositive: ratingSummary != null && ratingSummary.reviewCount > 0,
        icon: Star,
      },
    ];
  }, [orders, orderTotal, productTotal, ratingSummary]);

  const recentRows = useMemo(() => orders.slice(0, 4).map(orderToRecentRow), [orders]);

  if (loading) {
    return (
      <VendorDashboardLayout>
        <VendorStatRowSkeleton />
        <VendorDashboardChartRowSkeleton />
      </VendorDashboardLayout>
    );
  }

  return (
    <VendorDashboardLayout>
      {err ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground" role="status">
          {err}
        </div>
      ) : null}

      <VendorStatRow items={stats} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <VendorRevenueAreaChart data={weekRevenue} gradientId="prdDashRev" />
        <VendorRecentOrdersCard viewAllHref="/dashboard/product/orders" orders={recentRows} />
      </div>

      <VendorQuickActionStrip
        items={[
          { icon: Package, href: "/dashboard/product/products", label: "Products" },
          { icon: ShoppingCart, href: "/dashboard/product/orders", label: "Orders" },
          { icon: DollarSign, href: "/dashboard/product/settlements", label: "Settlements" },
          { icon: History, href: "/dashboard/product/payments", label: "Payments" },
          { icon: CreditCard, href: "/dashboard/product/bank", label: "Bank A/C" },
          { icon: ShieldCheck, href: "/dashboard/product/kyc", label: "KYC" },
        ]}
      />
    </VendorDashboardLayout>
  );
}
