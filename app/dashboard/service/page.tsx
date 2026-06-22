"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CreditCard,
  DollarSign,
  History,
  Loader2,
  ShoppingCart,
  Star,
  Wrench,
} from "lucide-react";
import {
  VendorQuickActionStrip,
  VendorRecentOrdersCard,
  VendorRevenueAreaChart,
  VendorStatRow,
  type StatItem,
} from "@/components/vendor/VendorDashboardUi";
import { vendorBookingsApi, type VendorBookingRow } from "@/lib/api/vendorBookings";
import { vendorOfferedServicesApi } from "@/lib/api/vendorOfferedServices";
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

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [listRes, pendRes, offerings] = await Promise.all([
        vendorBookingsApi.list({ limit: 100, offset: 0 }),
        vendorBookingsApi.list({ status: "pending", limit: 1, offset: 0 }),
        vendorOfferedServicesApi.listOfferings().catch(() => []),
      ]);
      setBookings(listRes.items || []);
      setBookingRecordTotal(listRes.total ?? listRes.items?.length ?? 0);
      setPendingTotal(pendRes.total ?? 0);
      const activeOffers = offerings.filter((o) => o.isActive !== false);
      setServiceOfferingCount(activeOffers.length);
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
        title: "Booking revenue",
        value: formatInr(revenue),
        hint: `${bookingRecordTotal} booking${bookingRecordTotal === 1 ? "" : "s"} on record`,
        hintPositive: true,
        icon: DollarSign,
      },
      {
        title: "Pending confirmations",
        value: String(pendingTotal),
        hint: "Awaiting your approve or reject",
        hintPositive: true,
        icon: ShoppingCart,
      },
      {
        title: "Listed services",
        value: String(serviceOfferingCount),
        icon: Wrench,
      },
      {
        title: "Service rating",
        value: "—",
        hint: "Ratings are not available yet",
        icon: Star,
      },
    ];
  }, [sortedBookings, bookingRecordTotal, pendingTotal, serviceOfferingCount]);

  const recentRows = useMemo(
    () => sortedBookings.slice(0, 5).map(bookingToRecentRow),
    [sortedBookings],
  );

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-8">
      {err ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          {err}
        </div>
      ) : null}

      <VendorStatRow items={stats} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <VendorRevenueAreaChart data={weekRevenue} gradientId="svcDashRev" />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <VendorRecentOrdersCard
            title="Recent bookings"
            viewAllHref="/dashboard/service/bookings"
            orders={recentRows}
          />
        </div>
      </div>

      <section aria-label="Quick actions">
        <VendorQuickActionStrip
          items={[
            { icon: Wrench, href: "/dashboard/service/services", label: "Services" },
            { icon: CalendarClock, href: "/dashboard/service/availability", label: "Availability" },
            { icon: CalendarCheck, href: "/dashboard/service/bookings", label: "Bookings" },
            { icon: DollarSign, href: "/dashboard/service/settlements", label: "Settlements" },
            { icon: History, href: "/dashboard/service/payments", label: "Payment History" },
            { icon: CreditCard, href: "/dashboard/service/bank", label: "Bank Account" },
          ]}
        />
      </section>
    </div>
  );
}
