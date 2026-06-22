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
  statusTone: "danger" | "success" | "info" | "neutral";
};

const statusClass: Record<OrderRow["statusTone"], string> = {
  danger: "bg-destructive/10 text-destructive",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
};

export function VendorStatRow({ items }: { items: StatItem[] }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.title} className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{item.title}</p>
              <p className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">{item.value}</p>
              {item.hint ? (
                <p
                  className={cn(
                    "mt-1 text-xs",
                    item.hintPositive ? "font-medium text-success" : "text-muted-foreground",
                  )}
                >
                  {item.hint}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <item.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
            </div>
          </div>
        </Card>
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
}: {
  data?: { day: string; revenue: number }[];
  gradientId?: string;
}) {
  const maxRev = data.length > 0 ? Math.max(...data.map((d) => d.revenue)) : 0;
  const yMax = Math.max(4000, Math.ceil((maxRev * 1.12) / 1000) * 1000);

  return (
    <Card className="min-w-0 p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold text-foreground sm:mb-6 sm:text-base">
        This Week&apos;s Revenue
      </h2>
      <div className="h-[220px] w-full min-w-0 sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.32} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)}
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              axisLine={false}
              tickLine={false}
              domain={[0, yMax]}
              width={44}
            />
            <Tooltip
              formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(var(--border))",
                boxShadow: "var(--shadow-elevated)",
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
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
}: {
  title?: string;
  viewAllHref: string;
  orders: OrderRow[];
}) {
  return (
    <Card className="flex min-w-0 flex-col p-5 sm:p-6">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground sm:text-base">{title}</h2>
        <Link href={viewAllHref} className="text-xs font-semibold text-primary hover:underline sm:text-sm">
          View All
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
          Nothing to show yet.
        </p>
      ) : (
        <ul className="space-y-0">
          {orders.map((o, i) => (
            <li
              key={`${o.id}-${i}`}
              className={cn(
                "flex items-start justify-between gap-3 py-3 text-sm",
                i < orders.length - 1 && "border-b border-border/50",
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{o.id}</p>
                <p className="truncate text-muted-foreground">{o.customer}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-foreground">{o.amount}</p>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize sm:text-xs",
                    statusClass[o.statusTone],
                  )}
                >
                  {o.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export type QuickItem = { icon: LucideIcon; href: string; label: string };

export function VendorQuickActionStrip({ items }: { items: QuickItem[] }) {
  return (
    <div className="grid min-w-0 grid-cols-3 gap-3 sm:grid-cols-6">
      {items.map(({ icon: Icon, href, label }) => (
        <Link key={href} href={href} title={label} aria-label={label}>
          <Card className="flex aspect-square max-h-[104px] flex-col items-center justify-center gap-2 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5">
            <Icon className="h-7 w-7 text-primary sm:h-8 sm:w-8" aria-hidden />
            <span className="hidden text-[10px] font-medium text-muted-foreground sm:block">{label}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
