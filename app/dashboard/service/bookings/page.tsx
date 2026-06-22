"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock3 } from "lucide-react";
import type { VendorBookingRow } from "@/lib/api/vendorBookings";
import { vendorBookingsApi } from "@/lib/api/vendorBookings";
import { vendorOfferedServicesApi } from "@/lib/api/vendorOfferedServices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  if (s === "in_progress") return "progress";
  if (s === "completed") return "done";
  if (s === "rejected" || s === "cancelled") return "muted";
  return "muted";
}

function badgeVariant(tone: ReturnType<typeof statusTone>): "warning" | "default" | "success" | "secondary" {
  switch (tone) {
    case "pending":
      return "warning";
    case "progress":
      return "default";
    case "done":
      return "success";
    default:
      return "secondary";
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

  async function review(row: VendorBookingRow, decision: "approved" | "rejected" | "completed" | "in_progress") {
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
      { key: "pending", label: "Pending", value: counts.pending, icon: Clock3, iconClass: "bg-warning/10 text-warning", valueClass: "text-warning" },
      { key: "inProgress", label: "In progress", value: counts.inProgress, icon: CalendarCheck, iconClass: "bg-primary/10 text-primary", valueClass: "text-primary" },
      { key: "completed", label: "Completed", value: counts.completed, icon: CheckCircle2, iconClass: "bg-success/10 text-success", valueClass: "text-success" },
    ],
    [counts],
  );

  return (
    <div className="min-w-0 space-y-6">
      <p className="text-sm text-muted-foreground">Review and manage customer service requests.</p>

      <div className="grid gap-4 sm:grid-cols-3">
        {summary.map(({ key, label, value, icon: Icon, iconClass, valueClass }) => (
          <Card key={key} className="flex items-center gap-4 p-5">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconClass)}>
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className={cn("text-3xl font-semibold tabular-nums leading-none", valueClass)}>{value}</p>
              <p className="mt-1.5 text-sm font-medium text-muted-foreground">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <CalendarCheck className="h-12 w-12 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-medium">No service bookings yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              <tbody className="divide-y divide-border">
                {items.map((row) => {
                  const st = String(row.status || "pending").toLowerCase();
                  const tone = statusTone(st);
                  const busy = actionId === row.id;
                  return (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">{bookingRef(row.id)}</td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-foreground">{customerLabel(row)}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-foreground">{serviceLabel(row.serviceId)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-foreground">{formatBookingDate(row.bookingDate)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-foreground">{row.timeSlot || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant(tone)} className="capitalize">
                          {st}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {st === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" disabled={busy} onClick={() => void review(row, "approved")}>
                              Approve
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void review(row, "rejected")}>
                              Reject
                            </Button>
                          </div>
                        ) : st === "approved" || st === "in_progress" ? (
                          <div className="flex justify-end gap-2">
                            {st === "approved" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void review(row, "in_progress")}
                              >
                                Start
                              </Button>
                            ) : null}
                            <Button type="button" size="sm" disabled={busy} onClick={() => void review(row, "completed")}>
                              Complete
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              Showing {offset + 1}–{Math.min(offset + items.length, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={!canPrev} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}>
                Previous
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={!canNext} onClick={() => setOffset((o) => o + PAGE_SIZE)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
