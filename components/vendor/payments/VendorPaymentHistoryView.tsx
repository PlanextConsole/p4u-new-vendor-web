"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, DollarSign, Search } from "lucide-react";
import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";
import { vendorSettlementsApi } from "@/lib/api/vendorSettlements";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  displaySettlementRef,
  formatInr,
  formatListDayMonthYear,
  formatShortDate,
  grossAndCommission,
  metaRecord,
  orderRefFromRow,
  parseAmount,
  statusBadgeClass,
} from "@/lib/vendor/settlementDisplay";
import { cn } from "@/lib/utils";

function matchesSearch(row: VendorSettlementRow, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const ref = displaySettlementRef(row).toLowerCase();
  const ord = orderRefFromRow(row).toLowerCase();
  const id = row.id.toLowerCase();
  return ref.includes(t) || ord.includes(t) || id.includes(t);
}

function inDateRange(row: VendorSettlementRow, from: string, to: string): boolean {
  if (!from && !to) return true;
  const raw = row.createdAt || row.updatedAt;
  const ts = raw ? new Date(raw).getTime() : NaN;
  if (Number.isNaN(ts)) return true;
  if (from) {
    const start = new Date(`${from}T00:00:00`).getTime();
    if (ts < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`).getTime();
    if (ts > end) return false;
  }
  return true;
}

export default function VendorPaymentHistoryView() {
  const [items, setItems] = useState<VendorSettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await vendorSettlementsApi.list({ limit: 100, offset: 0 });
      setItems(res.items || []);
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load payment history",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => items.filter((row) => matchesSearch(row, q) && inDateRange(row, dateFrom, dateTo)),
    [items, q, dateFrom, dateTo],
  );

  const stats = useMemo(() => {
    let settled = 0;
    let pending = 0;
    for (const r of filtered) {
      const amt = parseAmount(r.amount);
      const s = r.status.toLowerCase();
      if (s === "settled" || s === "completed" || s === "paid") settled += amt;
      if (s === "pending" || s === "created" || s === "processing" || s === "queued") pending += amt;
    }
    return { settled, pending, count: filtered.length };
  }, [filtered]);

  const statCards = [
    { label: "Total Settled", value: formatInr(stats.settled), icon: ArrowDownLeft, iconClass: "bg-success/10 text-success", valueClass: "text-success" },
    { label: "Pending", value: formatInr(stats.pending), icon: ArrowUpRight, iconClass: "bg-warning/10 text-warning", valueClass: "text-warning" },
    { label: "Total Transactions", value: String(stats.count), icon: DollarSign, iconClass: "bg-primary/10 text-primary", valueClass: "text-primary" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <p className="text-sm text-muted-foreground">Settlement payouts and transaction activity.</p>

      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          : statCards.map((s) => (
              <Card key={s.label} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                    <p className={cn("mt-2 text-2xl font-bold tracking-tight", s.valueClass)}>{s.value}</p>
                  </div>
                  <div className={cn("rounded-xl p-2.5", s.iconClass)}>
                    <s.icon className="h-6 w-6" aria-hidden />
                  </div>
                </div>
              </Card>
            ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            className="pl-9"
            placeholder="Search by ID or Order ID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search transactions"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" className="min-w-[140px] pr-10" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="From date" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">to</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" className="min-w-[140px] pr-10" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="To date" />
          </div>
        </div>
      </div>

      {loading ? (
        <ul className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          {items.length === 0
            ? "No transactions yet. They appear when orders generate settlements."
            : "No transactions match your search or date range."}
        </Card>
      ) : (
        <ul className="space-y-4">
          {filtered.map((row) => {
            const md = metaRecord(row.metadata);
            const orderRef = orderRefFromRow(row);
            const { gross, commission } = grossAndCommission(row);
            const isSettled = ["settled", "completed", "paid"].includes(row.status.toLowerCase());
            const settledWhen = isSettled
              ? formatShortDate(
                  (typeof md.settledAt === "string" && md.settledAt) ||
                    (typeof md.settled_at === "string" && md.settled_at) ||
                    row.updatedAt,
                )
              : null;

            return (
              <li key={row.id}>
                <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-start">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-foreground">{displaySettlementRef(row)}</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                          statusBadgeClass(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Order:</span> {orderRef}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatListDayMonthYear(row.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end sm:text-right">
                    <p className="text-2xl font-bold text-success">{formatInr(row.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      Gross: {formatInr(gross)} · Comm: {formatInr(commission)}
                    </p>
                    {settledWhen ? (
                      <p className="text-xs font-semibold text-success">Settled: {settledWhen}</p>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
