"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, DollarSign, Search } from "lucide-react";
import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";
import { vendorSettlementsApi } from "@/lib/api/vendorSettlements";
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

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-slate-500">Settlement payouts and transaction activity.</p>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Settled</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600">{formatInr(stats.settled)}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <ArrowDownLeft className="h-6 w-6" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-orange-500">{formatInr(stats.pending)}</p>
            </div>
            <div className="rounded-xl bg-orange-50 p-2.5 text-orange-500">
              <ArrowUpRight className="h-6 w-6" aria-hidden />
            </div>
          </div>
        </div>
        <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Transactions</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-[#20a090]">{stats.count}</p>
            </div>
            <div className="rounded-xl bg-[#20a090]/10 p-2.5 text-[#20a090]">
              <DollarSign className="h-6 w-6" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            className="input w-full py-2.5 !pl-12 pr-3"
            placeholder="Search by ID or Order ID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search transactions"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              className="input min-w-[140px] py-2.5 pl-3 pr-10 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
            />
          </div>
          <span className="text-sm font-medium text-slate-500">to</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              className="input min-w-[140px] py-2.5 pl-3 pr-10 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-600">Loading payment history…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-slate-100 bg-white p-12 text-center text-slate-600 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          {items.length === 0
            ? "No transactions yet. They appear when orders generate settlements."
            : "No transactions match your search or date range."}
        </div>
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
              <li
                key={row.id}
                className="flex flex-col justify-between gap-4 rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:flex-row sm:items-start"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-bold text-slate-900">{displaySettlementRef(row)}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    <span className="font-medium text-slate-600">Order:</span> {orderRef}
                  </p>
                  <p className="text-sm text-slate-500">{formatListDayMonthYear(row.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end sm:text-right">
                  <p className="text-2xl font-bold text-emerald-600">{formatInr(row.amount)}</p>
                  <p className="text-xs text-slate-500">
                    Gross: {formatInr(gross)} · Comm: {formatInr(commission)}
                  </p>
                  {settledWhen ? (
                    <p className="text-xs font-semibold text-emerald-700">Settled: {settledWhen}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
