"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, DollarSign, XCircle } from "lucide-react";
import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";
import { vendorSettlementsApi } from "@/lib/api/vendorSettlements";
import { vendorBookingsApi } from "@/lib/api/vendorBookings";
import { Card } from "@/components/ui/card";
import {
  VendorListEmpty,
  VendorListLayout,
  VendorListPagination,
  VendorListStatRowCentered,
  VendorListToolbar,
  VendorStatusBadge,
} from "@/components/vendor/VendorListUi";
import {
  completedBookingsAsPendingSettlements,
  displaySettlementRef,
  formatInr,
  formatShortDate,
  grossAndCommission,
  metaRecord,
  orderRefFromRow,
  parseAmount,
} from "@/lib/vendor/settlementDisplay";

const PER_PAGE = 10;

export default function VendorSettlementsView() {
  const [items, setItems] = useState<VendorSettlementRow[]>([]);
  const [statsRows, setStatsRows] = useState<VendorSettlementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const [settlementsRes, completedBookingsRes] = await Promise.all([
        vendorSettlementsApi.list({ limit: 500, offset: 0 }),
        vendorBookingsApi.list({ status: "completed", limit: 500, offset: 0 }),
      ]);
      const settlements = settlementsRes.items || [];
      const bookingSettlements = completedBookingsAsPendingSettlements(completedBookingsRes.items || [], settlements);
      setStatsRows([...settlements, ...bookingSettlements]);
    } catch {
      setStatsRows([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const offset = (page - 1) * PER_PAGE;
      const [settlementsRes, completedBookingsRes] = await Promise.all([
        vendorSettlementsApi.list({ limit: 500, offset: 0 }),
        vendorBookingsApi.list({ status: "completed", limit: 500, offset: 0 }),
      ]);
      const settlements = settlementsRes.items || [];
      const bookingSettlements = completedBookingsAsPendingSettlements(completedBookingsRes.items || [], settlements);
      const merged = [...settlements, ...bookingSettlements]
        .filter((row) => !statusFilter || row.status.toLowerCase() === statusFilter.toLowerCase())
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setItems(merged.slice(offset, offset + PER_PAGE));
      setTotal(merged.length);
    } catch (e: unknown) {
      setErr(
        e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load settlements",
      );
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let pending = 0;
    let settled = 0;
    let rejected = 0;
    for (const r of statsRows) {
      const amt = parseAmount(r.amount);
      const s = r.status.toLowerCase();
      if (s === "pending" || s === "created" || s === "processing" || s === "queued" || s === "eligible") pending += amt;
      else if (s === "settled" || s === "completed" || s === "paid") settled += amt;
      else if (s === "rejected" || s === "failed" || s === "cancelled" || s === "on_hold") rejected += amt;
    }
    const totalEarned = pending + settled;
    return { totalEarned, pending, settled, rejected };
  }, [statsRows]);

  const statCards = [
    { label: "Total Earned", value: formatInr(stats.totalEarned), icon: DollarSign, iconClass: "text-success", valueClass: "text-success" },
    { label: "Pending Settlement", value: formatInr(stats.pending), icon: Clock3, iconClass: "text-warning", valueClass: "text-warning" },
    { label: "Settled", value: formatInr(stats.settled), icon: CheckCircle2, iconClass: "text-success", valueClass: "text-success" },
    { label: "Rejected", value: formatInr(stats.rejected), icon: XCircle, iconClass: "text-destructive", valueClass: "text-destructive" },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <VendorListLayout>
      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <VendorListStatRowCentered items={statCards} cols={4} />
      )}

      <VendorListToolbar>
        <select
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Settlement status"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="eligible">Eligible</option>
          <option value="settled">Settled</option>
          <option value="rejected">Rejected</option>
          <option value="on_hold">On hold</option>
        </select>
        {statusFilter ? (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setStatusFilter("");
              setPage(1);
            }}
          >
            Clear
          </button>
        ) : null}
      </VendorListToolbar>

      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "settlement" : "settlements"}
      </p>

      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <VendorListEmpty title="No settlements found" subtitle="They appear after customer orders are paid and processed." />
      ) : (
        <ul className="space-y-3">
          {items.map((row) => {
            const md = metaRecord(row.metadata);
            const orderRef = orderRefFromRow(row);
            const txn =
              (typeof md.transactionRef === "string" && md.transactionRef) ||
              (typeof md.txn === "string" && md.txn) ||
              (typeof md.bankTxnId === "string" && md.bankTxnId) ||
              "-";
            const { gross, commission } = grossAndCommission(row);
            const settledLabel =
              row.status.toLowerCase() === "settled" || row.status.toLowerCase() === "completed"
                ? formatShortDate(
                    (typeof md.settledAt === "string" && md.settledAt) ||
                      (typeof md.settled_at === "string" && md.settled_at) ||
                      row.updatedAt,
                  )
                : null;
            const rejection =
              (typeof md.rejectionReason === "string" && md.rejectionReason) ||
              (typeof md.rejection_reason === "string" && md.rejection_reason) ||
              "";

            return (
              <li key={row.id}>
                <Card className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{displaySettlementRef(row)}</p>
                        <VendorStatusBadge status={row.status} kind="settlement" />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">Order: {orderRef}</p>
                      {txn !== "-" ? (
                        <p className="text-xs text-muted-foreground">
                          Txn: <span className="font-mono">{txn}</span>
                        </p>
                      ) : null}
                      {rejection ? <p className="mt-1 text-xs text-destructive">Reason: {rejection}</p> : null}
                    </div>
                    <p className="shrink-0 text-sm font-bold text-success">{formatInr(row.amount)}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Gross: {formatInr(gross)}</span>
                    <span>Commission: {formatInr(commission)}</span>
                    {settledLabel ? <span>Settled: {settledLabel}</span> : null}
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
