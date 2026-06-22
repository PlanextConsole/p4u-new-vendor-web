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

export type StatItem = {
  title: string;
  value: string;
  hint?: string;
  /** When true, hint renders in emerald (e.g. order counts). */
  hintPositive?: boolean;
  icon: LucideIcon;
};

export type OrderRow = {
  id: string;
  customer: string;
  amount: string;
  status: string;
  /** cancelled | delivered | completed | placed | … */
  statusTone: "danger" | "success" | "info" | "neutral";
};

const statusClass: Record<OrderRow["statusTone"], string> = {
  danger: "bg-rose-100 text-rose-800",
  success: "bg-emerald-100 text-emerald-800",
  info: "bg-sky-100 text-sky-800",
  neutral: "bg-slate-100 text-slate-700",
};

export function VendorStatRow({ items }: { items: StatItem[] }) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-[14px] border border-slate-100/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{item.title}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{item.value}</p>
              {item.hint ? (
                <p
                  className={
                    item.hintPositive ? "mt-1 text-xs font-medium text-emerald-600" : "mt-1 text-xs text-slate-500"
                  }
                >
                  {item.hint}
                </p>
              ) : null}
            </div>
            <item.icon className="h-8 w-8 shrink-0 text-[#20a090] opacity-90" aria-hidden />
          </div>
        </div>
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
    <div className="min-w-0 rounded-[14px] border border-slate-100/80 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
      <h2 className="mb-6 text-lg font-semibold text-slate-900">This Week&apos;s Revenue</h2>
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#20a090" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#20a090" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)}
              tick={{ fontSize: 12 }}
              stroke="#94a3b8"
              axisLine={false}
              tickLine={false}
              domain={[0, yMax]}
              width={44}
            />
            <Tooltip
              formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 14px rgba(15,23,42,0.08)",
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#20a090"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
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
    <div className="min-w-0 rounded-[14px] border border-slate-100/80 bg-white p-6 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <Link href={viewAllHref} className="text-sm font-semibold text-[#20a090] hover:underline">
          View All
        </Link>
      </div>
      {orders.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">Nothing to show yet.</p>
      ) : (
        <ul className="space-y-0">
          {orders.map((o, i) => (
            <li
              key={`${o.id}-${i}`}
              className={`flex items-start justify-between gap-3 py-3 text-sm ${
                i < orders.length - 1 ? "border-b border-slate-100" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{o.id}</p>
                <p className="truncate text-slate-500">{o.customer}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-slate-900">{o.amount}</p>
                <span
                  className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusClass[o.statusTone]}`}
                >
                  {o.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type QuickItem = { icon: LucideIcon; href: string; label: string };

/** Icon-first quick strip (labels via `title` for hover / screen readers). */
export function VendorQuickActionStrip({ items }: { items: QuickItem[] }) {
  return (
    <div className="grid min-w-0 grid-cols-3 gap-3 sm:grid-cols-6">
      {items.map(({ icon: Icon, href, label }) => (
        <Link
          key={href}
          href={href}
          title={label}
          aria-label={label}
          className="flex aspect-square max-h-[104px] flex-col items-center justify-center rounded-[14px] border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition hover:border-[#20a090]/35 hover:shadow-md"
        >
          <Icon className="h-8 w-8 text-[#20a090]" aria-hidden />
        </Link>
      ))}
    </div>
  );
}
