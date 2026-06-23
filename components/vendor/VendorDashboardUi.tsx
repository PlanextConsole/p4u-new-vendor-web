"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatItem = {
  title: string;
  value: string;
  hint?: string;
  hintPositive?: boolean;
  icon: LucideIcon;
};

export type OrderRow = {
  id: string;
  customer: string;
  amount: string;
  status: string;
  statusTone: "danger" | "success" | "info" | "neutral" | "warning" | "primary";
};

const statusClass: Record<OrderRow["statusTone"], string> = {
  primary: "bg-primary/10 text-primary",
  danger: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-muted text-muted-foreground",
};

/** Planext4u dashboard content width — `max-w-5xl` centered column. */
export function VendorDashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl space-y-6">{children}</div>;
}

export function VendorStatRow({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.title} className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{item.title}</span>
            <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-xl font-bold text-foreground">{item.value}</p>
          {item.hint ? (
            <p className={cn("mt-0.5 text-xs", item.hintPositive ? "text-success" : "text-muted-foreground")}>
              {item.hint}
            </p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export function VendorStatRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

const defaultWeekRevenue = [
  { day: "Mon", revenue: 4000 },
  { day: "Tue", revenue: 7200 },
  { day: "Wed", revenue: 5800 },
  { day: "Thu", revenue: 12000 },
  { day: "Fri", revenue: 22000 },
  { day: "Sat", revenue: 28000 },
  { day: "Sun", revenue: 14000 },
];

export function VendorRevenueAreaChart({
  data = defaultWeekRevenue,
  gradientId = "vendorRevGrad",
  className,
}: {
  data?: { day: string; revenue: number }[];
  gradientId?: string;
  className?: string;
}) {
  const maxRev = data.length > 0 ? Math.max(...data.map((d) => d.revenue)) : 0;
  const yMax = Math.max(4000, Math.ceil((maxRev * 1.15) / 1000) * 1000);

  return (
    <Card className={cn("min-w-0 p-5 lg:col-span-2", className)}>
      <h3 className="mb-4 text-sm font-semibold text-foreground">This Week&apos;s Revenue</h3>
      <div className="h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickFormatter={(v) => `₹${(Number(v) / 1000).toFixed(0)}k`}
              domain={[0, yMax]}
              width={40}
            />
            <Tooltip formatter={(v: number) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              fill={`url(#${gradientId})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function VendorRecentOrdersCard({
  title = "Recent Orders",
  viewAllHref,
  orders,
  className,
}: {
  title?: string;
  viewAllHref: string;
  orders: OrderRow[];
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 p-5", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Link href={viewAllHref} className="text-xs text-primary hover:underline">
          View All
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o, i) => (
            <div key={`${o.id}-${i}`} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">{o.id}</p>
                <p className="text-[11px] text-muted-foreground">{o.customer}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold text-foreground">{o.amount}</p>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] capitalize",
                    statusClass[o.statusTone],
                  )}
                >
                  {o.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export type QuickItem = { icon: LucideIcon; href: string; label: string };

export function VendorQuickActionStrip({ items }: { items: QuickItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(({ icon: Icon, href, label }) => (
        <Link key={href} href={href} title={label} aria-label={label}>
          <Card className="p-4 text-center transition-colors hover:border-primary/30">
            <Icon className="mx-auto mb-2 h-6 w-6 text-primary" aria-hidden />
            <p className="text-xs font-medium text-foreground">{label}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function VendorDashboardChartRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="h-[280px] animate-pulse rounded-2xl bg-muted lg:col-span-2" />
      <div className="h-[280px] animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
