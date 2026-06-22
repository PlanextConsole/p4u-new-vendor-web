"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, DollarSign, XCircle } from "lucide-react";
import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";
import { vendorSettlementsApi } from "@/lib/api/vendorSettlements";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  displaySettlementRef,
  formatInr,
  formatShortDate,
  grossAndCommission,
  metaRecord,
  orderRefFromRow,
  parseAmount,
  statusBadgeClass,
} from "@/lib/vendor/settlementDisplay";
import { cn } from "@/lib/utils";

export default function VendorSettlementsView() {
  const [items, setItems] = useState<VendorSettlementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await vendorSettlementsApi.list({ limit: 100, offset: 0 });
      setItems(res.items || []);
      setTotal(res.total ?? res.items?.length ?? 0);
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load settlements",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let pending = 0;
    let settled = 0;
    let rejected = 0;
    for (const r of items) {
      const amt = parseAmount(r.amount);
      const s = r.status.toLowerCase();
      if (s === "pending" || s === "created" || s === "processing" || s === "queued") pending += amt;
      else if (s === "settled" || s === "completed" || s === "paid") settled += amt;
      else if (s === "rejected" || s === "failed" || s === "cancelled") rejected += amt;
    }
    const totalEarned = pending + settled;
    return { totalEarned, pending, settled, rejected };
  }, [items]);

  const statCards = [
    { label: "Total Earned", value: formatInr(stats.totalEarned), icon: DollarSign, iconClass: "bg-success/10 text-success", valueClass: "text-success" },
    { label: "Pending Settlement", value: formatInr(stats.pending), icon: Clock3, iconClass: "bg-warning/10 text-warning", valueClass: "text-warning" },
    { label: "Settled", value: formatInr(stats.settled), icon: CheckCircle2, iconClass: "bg-success/10 text-success", valueClass: "text-success" },
    { label: "Rejected", value: formatInr(stats.rejected), icon: XCircle, iconClass: "bg-destructive/10 text-destructive", valueClass: "text-destructive" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <p className="text-sm text-muted-foreground">Track payouts and settlement status for your orders.</p>

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
                    <p className={cn("mt-2 text-2xl font-bold tracking-tight", s.valueClass)}>{s.value}</p>
                  </div>
                  <div className={cn("rounded-xl p-2.5", s.iconClass)}>
                    <s.icon className="h-6 w-6" aria-hidden />
                  </div>
                </div>
              </Card>
            ))}
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground">
          {total} {total === 1 ? "settlement" : "settlements"}
        </h2>

        {loading ? (
          <ul className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </ul>
        ) : items.length === 0 ? (
          <Card className="mt-4 p-12 text-center text-muted-foreground">
            No settlements yet. They appear after customer orders are paid and processed.
          </Card>
        ) : (
          <ul className="mt-4 space-y-4">
            {items.map((row) => {
              const md = metaRecord(row.metadata);
              const orderRef = orderRefFromRow(row);
              const txn =
                (typeof md.transactionRef === "string" && md.transactionRef) ||
                (typeof md.txn === "string" && md.txn) ||
                (typeof md.bankTxnId === "string" && md.bankTxnId) ||
                "—";
              const { gross, commission } = grossAndCommission(row);
              const settledLabel =
                row.status.toLowerCase() === "settled" || row.status.toLowerCase() === "completed"
                  ? formatShortDate(
                      (typeof md.settledAt === "string" && md.settledAt) ||
                        (typeof md.settled_at === "string" && md.settled_at) ||
                        row.updatedAt,
                    )
                  : "—";

              return (
                <li key={row.id}>
                  <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
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
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground">Order:</span> {orderRef}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Txn:</span> {txn}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Gross:</span> {formatInr(gross)}
                          <span className="mx-2 text-border">|</span>
                          <span className="font-medium text-foreground">Commission:</span> {formatInr(commission)}
                          <span className="mx-2 text-border">|</span>
                          <span className="font-medium text-foreground">Settled:</span> {settledLabel}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-2xl font-bold text-success">{formatInr(row.amount)}</p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
