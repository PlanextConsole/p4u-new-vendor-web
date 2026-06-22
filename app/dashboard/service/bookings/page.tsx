"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import type { VendorBookingRow } from "@/lib/api/vendorBookings";
import { vendorBookingsApi } from "@/lib/api/vendorBookings";
import { vendorOfferedServicesApi } from "@/lib/api/vendorOfferedServices";

const PAGE_SIZE = 20;

function bookingRef(id: string) {
  const raw = String(id || "").trim();
  if (!raw) return "—";
  return `BKG-${raw.slice(0, 8).toUpperCase()}`;
}

function formatBookingDate(ymd: string): string {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function customerLabel(row: VendorBookingRow): string {
  const m = row.metadata;
  if (m && typeof m === "object") {
    const n =
      (typeof m.customerName === "string" && m.customerName.trim()) ||
      (typeof m.fullName === "string" && m.fullName.trim()) ||
      (typeof m.customerDisplay === "string" && m.customerDisplay.trim());
    if (n) return n;
  }
  const id = String(row.customerId || "").trim();
  if (!id) return "—";
  return `Customer · ${id.slice(0, 8)}…`;
}

function statusTone(status: string): "pending" | "progress" | "done" | "muted" {
  const s = status.toLowerCase();
  if (s === "pending") return "pending";
  if (s === "approved") return "progress";
  if (s === "completed") return "done";
  if (s === "rejected" || s === "cancelled") return "muted";
  return "muted";
}

function badgeClass(tone: ReturnType<typeof statusTone>): string {
  switch (tone) {
    case "pending":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
    case "progress":
      return "bg-[#20a090]/12 text-[#0f766e] ring-1 ring-[#20a090]/25";
    case "done":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
  }
}

export default function VendorServiceBookingsPage() {
  const [items, setItems] = useState<VendorBookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, inProgress: 0, completed: 0 });

  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});

  const refreshCounts = useCallback(async () => {
    try {
      const [p, a, c] = await Promise.all([
        vendorBookingsApi.list({ status: "pending", limit: 1, offset: 0 }),
        vendorBookingsApi.list({ status: "approved", limit: 1, offset: 0 }),
        vendorBookingsApi.list({ status: "completed", limit: 1, offset: 0 }),
      ]);
      setCounts({
        pending: p.total ?? 0,
        inProgress: a.total ?? 0,
        completed: c.total ?? 0,
      });
    } catch {
      /* keep previous counts */
    }
  }, []);

  const loadOfferingsMap = useCallback(async () => {
    try {
      const offerings = await vendorOfferedServicesApi.listOfferings();
      const map: Record<string, string> = {};
      for (const o of offerings) {
        const sid = String(o.serviceId || "").trim();
        if (sid) map[sid] = String(o.catalogName || sid);
      }
      setServiceNames(map);
    } catch {
      setServiceNames({});
    }
  }, []);

  const loadTable = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await vendorBookingsApi.list({ limit: PAGE_SIZE, offset });
      setItems(list.items || []);
      setTotal(list.total ?? 0);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load bookings");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void loadOfferingsMap();
    void refreshCounts();
  }, [loadOfferingsMap, refreshCounts]);

  useEffect(() => {
    void loadTable();
  }, [loadTable]);

  const serviceLabel = useCallback(
    (serviceId: string | null) => {
      if (!serviceId) return "General service";
      return serviceNames[serviceId] || serviceId.slice(0, 8) + "…";
    },
    [serviceNames],
  );

  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  async function review(row: VendorBookingRow, decision: "approved" | "rejected") {
    setActionId(row.id);
    setErr("");
    try {
      const updated = await vendorBookingsApi.updateStatus(row.id, decision);
      const nextStatus = String(updated.status || decision).toLowerCase();
      setItems((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
      await refreshCounts();
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Update failed");
    } finally {
      setActionId(null);
    }
  }

  const summary = useMemo(
    () => [
      {
        key: "pending",
        label: "Pending",
        value: counts.pending,
        icon: Clock3,
        iconClass: "text-amber-600 bg-amber-50 ring-amber-200/80",
        valueClass: "text-amber-700",
      },
      {
        key: "inProgress",
        label: "In progress",
        value: counts.inProgress,
        icon: CalendarCheck,
        iconClass: "text-[#0f766e] bg-[#20a090]/12 ring-[#20a090]/25",
        valueClass: "text-[#0f766e]",
      },
      {
        key: "completed",
        label: "Completed",
        value: counts.completed,
        icon: CheckCircle2,
        iconClass: "text-emerald-700 bg-emerald-50 ring-emerald-200/80",
        valueClass: "text-emerald-800",
      },
    ],
    [counts],
  );

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-slate-500">Review and manage customer service requests.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {summary.map(({ key, label, value, icon: Icon, iconClass, valueClass }) => (
          <div
            key={key}
            className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ${iconClass}`}>
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className={`text-3xl font-semibold tabular-nums leading-none ${valueClass}`}>{value}</p>
              <p className="mt-1.5 text-sm font-medium text-slate-600">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {err}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading bookings…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <CalendarCheck className="h-12 w-12 text-slate-300" aria-hidden />
            <p className="text-sm font-medium text-slate-600">No service bookings yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => {
                  const st = String(row.status || "pending").toLowerCase();
                  const tone = statusTone(st);
                  const busy = actionId === row.id;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{bookingRef(row.id)}</td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-slate-700">{customerLabel(row)}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-700">{serviceLabel(row.serviceId)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatBookingDate(row.bookingDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{row.timeSlot || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${badgeClass(tone)}`}>
                          {st}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {st === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void review(row, "approved")}
                              className="rounded-lg bg-[#20a090] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1a8f80] disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void review(row, "rejected")}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && items.length > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
            <span>
              Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
