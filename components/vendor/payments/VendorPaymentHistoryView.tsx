"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, DollarSign, Search } from "lucide-react";
import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";
import { vendorSettlementsApi } from "@/lib/api/vendorSettlements";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  VendorListEmpty,
  VendorListLayout,
  VendorListPagination,
  VendorListStatRowHorizontal,
  VendorListToolbar,
  VendorStatusBadge,
} from "@/components/vendor/VendorListUi";
import {
  displaySettlementRef,
  formatInr,
  formatListDayMonthYear,
  formatShortDate,
  grossAndCommission,
  metaRecord,
  orderRefFromRow,
  parseAmount,
} from "@/lib/vendor/settlementDisplay";
import { cn } from "@/lib/utils";

const PER_PAGE = 10;

export default function VendorPaymentHistoryView() {
  const [items, setItems] = useState<VendorSettlementRow[]>([]);
  const [statsItems, setStatsItems] = useState<VendorSettlementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const filterParams = useMemo(
    () => ({
      q: q.trim() || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    }),
    [q, dateFrom, dateTo],
  );

  const loadStats = useCallback(async () => {
    try {
      const res = await vendorSettlementsApi.list({ ...filterParams, limit: 500, offset: 0 });
      setStatsItems(res.items || []);
    } catch {
      setStatsItems([]);
    }
  }, [filterParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const offset = (page - 1) * PER_PAGE;
      const res = await vendorSettlementsApi.list({ ...filterParams, limit: PER_PAGE, offset });
      setItems(res.items || []);
      setTotal(res.total ?? res.items?.length ?? 0);
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load payment history",
      );
    } finally {
      setLoading(false);
    }
  }, [filterParams, page]);

  useEffect(() => {
    setPage(1);
  }, [q, dateFrom, dateTo]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let settled = 0;
    let pending = 0;
    for (const r of statsItems) {
      const amt = parseAmount(r.amount);
      const s = r.status.toLowerCase();
      if (s === "settled" || s === "completed" || s === "paid") settled += amt;
      if (s === "pending" || s === "created" || s === "processing" || s === "queued" || s === "eligible") pending += amt;
    }
    return { settled, pending, count: statsItems.length };
  }, [statsItems]);

  const statCards = [
    { label: "Total Settled", value: formatInr(stats.settled), icon: ArrowDownLeft, iconClass: "bg-success/10 text-success", valueClass: "text-success" },
    { label: "Pending", value: formatInr(stats.pending), icon: ArrowUpRight, iconClass: "bg-warning/10 text-warning", valueClass: "text-warning" },
    { label: "Total Transactions", value: String(stats.count), icon: DollarSign, iconClass: "bg-primary/10 text-primary", valueClass: "text-primary" },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hasFilters = Boolean(qInput.trim() || dateFrom || dateTo);

  return (
    <VendorListLayout className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <VendorListStatRowHorizontal items={statCards} />
      )}

      <VendorListToolbar>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            className="pl-9"
            placeholder="Search by ID or Order ID..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            aria-label="Search transactions"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            type="date"
            className="w-36 text-xs"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-36 text-xs"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
          />
        </div>
      </VendorListToolbar>

      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <VendorListEmpty
          title={hasFilters ? "No transactions match your search or date range." : "No payment history found."}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((row) => {
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
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{displaySettlementRef(row)}</p>
                        <VendorStatusBadge status={row.status} kind="settlement" />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">Order: {orderRef}</p>
                      <p className="text-xs text-muted-foreground">{formatListDayMonthYear(row.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-sm font-bold", isSettled && "text-success")}>{formatInr(row.amount)}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Gross: {formatInr(gross)} · Comm: {formatInr(commission)}
                      </p>
                      {settledWhen ? <p className="mt-0.5 text-[10px] text-success">Settled: {settledWhen}</p> : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <VendorListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </VendorListLayout>
  );
}
