"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CreditCard,
  DollarSign,
  History,
  ShoppingCart,
  Star,
  Wrench,
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
import { vendorBookingsApi, type VendorBookingRow } from "@/lib/api/vendorBookings";
import { vendorOfferedServicesApi } from "@/lib/api/vendorOfferedServices";
import { vendorRatingsApi } from "@/lib/api/vendorRatings";
import { formatInr } from "@/lib/vendor/settlementDisplay";
import {
  bookingAmount,
  bookingToRecentRow,
  bookingYmd,
  buildWeekRevenueSeries,
} from "@/lib/vendor/dashboardMetrics";

export default function ServiceVendorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [bookings, setBookings] = useState<VendorBookingRow[]>([]);
  const [bookingRecordTotal, setBookingRecordTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [serviceOfferingCount, setServiceOfferingCount] = useState(0);
  const [ratingSummary, setRatingSummary] = useState<{ averageRating: number; reviewCount: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [listRes, pendRes, offerings, ratingsRes] = await Promise.all([
        vendorBookingsApi.list({ limit: 100, offset: 0 }),
        vendorBookingsApi.list({ status: "pending", limit: 1, offset: 0 }),
        vendorOfferedServicesApi.listOfferings().catch(() => []),
        vendorRatingsApi.getSummary().catch(() => null),
      ]);
      setBookings(listRes.items || []);
      setBookingRecordTotal(listRes.total ?? listRes.items?.length ?? 0);
      setPendingTotal(pendRes.total ?? 0);
      const activeOffers = offerings.filter((o) => o.isActive !== false);
      setServiceOfferingCount(activeOffers.length);
      setRatingSummary(ratingsRes);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load dashboard");
      setBookings([]);
      setBookingRecordTotal(0);
      setPendingTotal(0);
      setServiceOfferingCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }, [bookings]);

  const weekRevenue = useMemo(
    () => buildWeekRevenueSeries(sortedBookings, bookingYmd, bookingAmount),
    [sortedBookings],
  );

  const stats: StatItem[] = useMemo(() => {
    const revenue = sortedBookings.reduce((acc, b) => acc + bookingAmount(b), 0);
    return [
      {
        title: "Total Revenue",
        value: formatInr(revenue),
        hint: `${bookingRecordTotal} bookings`,
        hintPositive: true,
        icon: DollarSign,
      },
      {
        title: "Active Orders",
        value: String(pendingTotal),
        hint: "Awaiting confirmation",
        hintPositive: true,
        icon: ShoppingCart,
      },
      {
        title: "Listed Services",
        value: String(serviceOfferingCount),
        icon: Wrench,
      },
      {
        title: "Rating",
        value: ratingSummary && ratingSummary.reviewCount > 0 ? String(ratingSummary.averageRating) : "—",
        hint:
          ratingSummary && ratingSummary.reviewCount > 0
            ? `${ratingSummary.reviewCount} reviews`
            : undefined,
        hintPositive: ratingSummary != null && ratingSummary.reviewCount > 0,
        icon: Star,
      },
    ];
  }, [sortedBookings, bookingRecordTotal, pendingTotal, serviceOfferingCount, ratingSummary]);

  const recentRows = useMemo(
    () => sortedBookings.slice(0, 4).map(bookingToRecentRow),
    [sortedBookings],
  );

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
        <VendorRevenueAreaChart data={weekRevenue} gradientId="svcDashRev" />
        <VendorRecentOrdersCard
          title="Recent Bookings"
          viewAllHref="/dashboard/service/bookings"
          orders={recentRows}
        />
      </div>

      <VendorQuickActionStrip
        items={[
          { icon: Wrench, href: "/dashboard/service/services", label: "Services" },
          { icon: CalendarClock, href: "/dashboard/service/availability", label: "Availability" },
          { icon: CalendarCheck, href: "/dashboard/service/bookings", label: "Bookings" },
          { icon: DollarSign, href: "/dashboard/service/settlements", label: "Settlements" },
          { icon: History, href: "/dashboard/service/payments", label: "Payments" },
          { icon: CreditCard, href: "/dashboard/service/bank", label: "Bank A/C" },
        ]}
      />
    </VendorDashboardLayout>
  );
}
