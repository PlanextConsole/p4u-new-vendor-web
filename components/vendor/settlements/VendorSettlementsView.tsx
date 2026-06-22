"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, DollarSign, XCircle } from "lucide-react";
import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";
import { vendorSettlementsApi } from "@/lib/api/vendorSettlements";
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

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-slate-500">Track payouts and settlement status for your orders.</p>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Earned</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{formatInr(stats.totalEarned)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <DollarSign className="h-6 w-6" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending Settlement</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600">{formatInr(stats.pending)}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <Clock3 className="h-6 w-6" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-500">Settled</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700">{formatInr(stats.settled)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-500">Rejected</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-rose-600">{formatInr(stats.rejected)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
              <XCircle className="h-6 w-6" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-800">
          {total} {total === 1 ? "settlement" : "settlements"}
        </h2>

        {loading ? (
          <p className="mt-4 text-slate-600">Loading settlements…</p>
        ) : items.length === 0 ? (
          <div className="mt-4 rounded-[14px] border border-slate-100 bg-white p-12 text-center text-slate-600 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            No settlements yet. They appear after customer orders are paid and processed.
          </div>
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
                <li
                  key={row.id}
                  className="flex flex-col gap-4 rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-slate-900">{displaySettlementRef(row)}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-slate-500">
                      <p>
                        <span className="font-medium text-slate-600">Order:</span> {orderRef}
                      </p>
                      <p>
                        <span className="font-medium text-slate-600">Txn:</span> {txn}
                      </p>
                      <p className="text-slate-600">
                        <span className="font-medium">Gross:</span> {formatInr(gross)}
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="font-medium">Commission:</span> {formatInr(commission)}
                        <span className="mx-2 text-slate-300">|</span>
                        <span className="font-medium">Settled:</span> {settledLabel}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-2xl font-bold text-emerald-700">{formatInr(row.amount)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
