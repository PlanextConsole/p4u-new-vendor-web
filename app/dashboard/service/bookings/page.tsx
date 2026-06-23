"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock3 } from "lucide-react";
import type { VendorBookingRow } from "@/lib/api/vendorBookings";
import { vendorBookingsApi } from "@/lib/api/vendorBookings";
import { vendorOfferedServicesApi } from "@/lib/api/vendorOfferedServices";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  VendorListEmpty,
  VendorListLayout,
  VendorListStatRowCentered,
  VendorStatusBadge,
} from "@/components/vendor/VendorListUi";

function formatBookingDate(ymd: string): string {
  if (!ymd) return "—";
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatInr(amount?: string | number | null): string {
  const n = typeof amount === "string" ? parseFloat(amount) : Number(amount ?? 0);
  return `₹${(Number.isNaN(n) ? 0 : n).toLocaleString("en-IN")}`;
}

function serviceLabel(row: VendorBookingRow, names: Record<string, string>): string {
  const meta = row.metadata;
  if (meta && typeof meta === "object" && typeof meta.serviceName === "string" && meta.serviceName.trim()) {
    return meta.serviceName.trim();
  }
  const sid = String(row.serviceId || "").trim();
  if (!sid) return "General service";
  return names[sid] || `${sid.slice(0, 8)}…`;
}

function sectionFor(status: string): "pending" | "active" | "done" | "other" {
  const s = status.toLowerCase();
  if (s === "pending" || s === "approved" || s === "confirmed") return "pending";
  if (s === "in_progress") return "active";
  if (s === "completed" || s === "cancelled" || s === "rejected") return "done";
  return "other";
}

function BookingCard({
  row,
  serviceTitle,
  busy,
  onReview,
}: {
  row: VendorBookingRow;
  serviceTitle: string;
  busy: boolean;
  onReview: (row: VendorBookingRow, decision: "approved" | "rejected" | "in_progress" | "completed") => void;
}) {
  const st = String(row.status || "pending").toLowerCase();
  const notes = row.notes?.trim();

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{serviceTitle}</p>
          <p className="text-xs text-muted-foreground">
            {formatBookingDate(row.bookingDate)} · {row.timeSlot || "—"}
          </p>
        </div>
        <VendorStatusBadge status={st} kind="order" />
      </div>

      {notes ? <p className="mb-2 text-xs text-muted-foreground">Note: {notes}</p> : null}

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">{formatInr(row.totalAmount)}</p>
        <div className="flex flex-wrap justify-end gap-2">
          {st === "pending" ? (
            <>
              <Button type="button" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => onReview(row, "approved")}>
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs text-destructive"
                disabled={busy}
                onClick={() => onReview(row, "rejected")}
              >
                Reject
              </Button>
            </>
          ) : null}
          {st === "approved" ? (
            <Button type="button" size="sm" className="h-7 gap-1 text-xs" disabled={busy} onClick={() => onReview(row, "in_progress")}>
              <Clock3 className="h-3 w-3" />
              Start
            </Button>
          ) : null}
          {st === "in_progress" ? (
            <Button type="button" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => onReview(row, "completed")}>
              Complete
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function VendorServiceBookingsPage() {
  const [items, setItems] = useState<VendorBookingRow[]>([]);
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
      const inProgress = await vendorBookingsApi.list({ status: "in_progress", limit: 1, offset: 0 });
      setCounts({
        pending: (p.total ?? 0) + (a.total ?? 0),
        inProgress: inProgress.total ?? 0,
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

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await vendorBookingsApi.list({ limit: 100, offset: 0 });
      setItems(list.items || []);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load bookings");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOfferingsMap();
    void refreshCounts();
  }, [loadOfferingsMap, refreshCounts]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const pending: VendorBookingRow[] = [];
    const active: VendorBookingRow[] = [];
    const done: VendorBookingRow[] = [];
    for (const row of items) {
      const section = sectionFor(String(row.status || "pending"));
      if (section === "pending") pending.push(row);
      else if (section === "active") active.push(row);
      else if (section === "done") done.push(row);
    }
    return { pending, active, done };
  }, [items]);

  const statCards = useMemo(
    () => [
      { label: "Pending", value: String(counts.pending), icon: Clock3, iconClass: "text-warning", valueClass: "text-warning" },
      { label: "In Progress", value: String(counts.inProgress), icon: CalendarCheck, iconClass: "text-primary", valueClass: "text-primary" },
      { label: "Completed", value: String(counts.completed), icon: CheckCircle2, iconClass: "text-success", valueClass: "text-success" },
    ],
    [counts],
  );

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

  const hasAny = grouped.pending.length + grouped.active.length + grouped.done.length > 0;

  return (
    <VendorListLayout>
      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <VendorListStatRowCentered items={statCards} />
      )}

      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : !hasAny ? (
        <VendorListEmpty icon={CalendarCheck} title="No service bookings yet" />
      ) : (
        <div className="space-y-3">
          {grouped.pending.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-warning">
                Pending / Confirmed ({grouped.pending.length})
              </h3>
              {grouped.pending.map((row) => (
                <BookingCard
                  key={row.id}
                  row={row}
                  serviceTitle={serviceLabel(row, serviceNames)}
                  busy={actionId === row.id}
                  onReview={(r, d) => void review(r, d)}
                />
              ))}
            </>
          ) : null}
          {grouped.active.length > 0 ? (
            <>
              <h3 className="mt-4 text-sm font-semibold text-primary">In Progress ({grouped.active.length})</h3>
              {grouped.active.map((row) => (
                <BookingCard
                  key={row.id}
                  row={row}
                  serviceTitle={serviceLabel(row, serviceNames)}
                  busy={actionId === row.id}
                  onReview={(r, d) => void review(r, d)}
                />
              ))}
            </>
          ) : null}
          {grouped.done.length > 0 ? (
            <>
              <h3 className="mt-4 text-sm font-semibold text-success">
                Completed / Cancelled ({grouped.done.length})
              </h3>
              {grouped.done.map((row) => (
                <BookingCard
                  key={row.id}
                  row={row}
                  serviceTitle={serviceLabel(row, serviceNames)}
                  busy={actionId === row.id}
                  onReview={(r, d) => void review(r, d)}
                />
              ))}
            </>
          ) : null}
        </div>
      )}
    </VendorListLayout>
  );
}
