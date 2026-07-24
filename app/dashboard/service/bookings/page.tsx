"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CheckCircle2, Clock3, X } from "lucide-react";
import type { VendorBookingRow } from "@/lib/api/vendorBookings";
import { vendorBookingsApi } from "@/lib/api/vendorBookings";
import { vendorOfferedServicesApi } from "@/lib/api/vendorOfferedServices";
import { vendorUploadImage } from "@/lib/api/vendorUpload";
import { resolveMediaUrl } from "@/lib/media";
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

function mediaUrl(u: string) {
  return resolveMediaUrl(u) || u;
}

function bookingMeta(row: VendorBookingRow): Record<string, unknown> {
  const m = row.metadata;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  return m as Record<string, unknown>;
}

function serviceLabel(row: VendorBookingRow, names: Record<string, string>): string {
  const meta = bookingMeta(row);
  if (typeof meta.serviceName === "string" && meta.serviceName.trim()) {
    return meta.serviceName.trim();
  }
  const sid = String(row.serviceId || "").trim();
  if (!sid) return "General service";
  return names[sid] || `${sid.slice(0, 8)}…`;
}

function serviceImageOf(row: VendorBookingRow): string {
  const meta = bookingMeta(row);
  const raw =
    (typeof meta.serviceImage === "string" && meta.serviceImage) ||
    (typeof meta.service_image === "string" && meta.service_image) ||
    (typeof meta.imageUrl === "string" && meta.imageUrl) ||
    "";
  return String(raw).trim();
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
  onCancel,
  onComplete,
}: {
  row: VendorBookingRow;
  serviceTitle: string;
  busy: boolean;
  onReview: (row: VendorBookingRow, decision: "approved" | "rejected" | "in_progress") => void;
  onCancel: (row: VendorBookingRow) => void;
  onComplete: (row: VendorBookingRow) => void;
}) {
  const st = String(row.status || "pending").toLowerCase();
  const notes = row.notes?.trim();
  const img = serviceImageOf(row);
  const canCancel = st === "approved" || st === "in_progress";

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(img)} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{serviceTitle}</p>
            <p className="text-xs text-muted-foreground">
              {formatBookingDate(row.bookingDate)} · {row.timeSlot || "—"}
            </p>
          </div>
        </div>
        <VendorStatusBadge status={st} kind="order" />
      </div>

      {notes ? <p className="mb-2 text-xs text-muted-foreground">Note: {notes}</p> : null}
      {row.metadata?.completionProof && typeof row.metadata.completionProof === "object" ? (
        <p className="mb-2 rounded-lg bg-primary/5 px-2 py-1 text-xs text-primary">
          Completion:{" "}
          {String((row.metadata.completionProof as Record<string, unknown>).status || "pending").replace(
            /_/g,
            " ",
          )}
        </p>
      ) : null}
      {row.metadata?.dispute && typeof row.metadata.dispute === "object" ? (
        <p className="mb-2 rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive">
          Dispute: {String((row.metadata.dispute as Record<string, unknown>).status || "open")}
        </p>
      ) : null}

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
            <Button type="button" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => onComplete(row)}>
              Complete
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs text-destructive"
              disabled={busy}
              onClick={() => onCancel(row)}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function CompletionProofDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (photoUrl: string, notes: string, otp: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [notes, setNotes] = useState("");
  const [otp, setOtp] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localErr, setLocalErr] = useState("");

  useEffect(() => {
    if (!open) {
      setPhotoUrl("");
      setPreview("");
      setNotes("");
      setOtp("");
      setLocalErr("");
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  if (!open) return null;

  async function onFile(file: File | null) {
    if (!file) return;
    setLocalErr("");
    setUploading(true);
    try {
      const url = await vendorUploadImage(file);
      setPhotoUrl(url);
      setPreview(URL.createObjectURL(file));
    } catch (e: unknown) {
      setLocalErr(
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setLocalErr("");
    const url = photoUrl.trim();
    if (!url) {
      setLocalErr("A completion photo is required.");
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setLocalErr("Enter a valid 6-digit OTP.");
      return;
    }
    onSubmit(url, notes.trim(), otp.trim());
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="completion-dialog-title" className="text-lg font-bold">
              Complete service
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload a completion photo, then enter the customer OTP.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Completion photo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-sm"
              disabled={busy || uploading}
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            <input
              className="input mt-2 w-full text-sm"
              placeholder="Or paste image URL"
              value={photoUrl}
              disabled={busy || uploading}
              onChange={(e) => {
                setPhotoUrl(e.target.value);
                setPreview(e.target.value.trim());
              }}
            />
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(preview)}
                alt="Completion preview"
                className="mt-2 max-h-40 rounded-xl object-cover ring-1 ring-border"
              />
            ) : null}
          </div>
          <label className="block text-sm">
            <span className="font-medium text-muted-foreground">Notes (optional)</span>
            <textarea
              className="input mt-1 w-full min-h-[72px]"
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-muted-foreground">Customer OTP</span>
            <input
              className="input mt-1 w-full"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit OTP"
              value={otp}
              disabled={busy}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          {localErr ? <p className="text-sm text-destructive">{localErr}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy || uploading} onClick={onClose}>
            Close
          </Button>
          <Button type="button" disabled={busy || uploading} onClick={submit}>
            {uploading ? "Uploading…" : busy ? "Saving…" : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VendorServiceBookingsPage() {
  const [items, setItems] = useState<VendorBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, inProgress: 0, completed: 0 });
  const [serviceNames, setServiceNames] = useState<Record<string, string>>({});
  const [completeRow, setCompleteRow] = useState<VendorBookingRow | null>(null);

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

  async function review(row: VendorBookingRow, decision: "approved" | "rejected" | "in_progress" | "cancelled") {
    setActionId(row.id);
    setErr("");
    try {
      const updated = await vendorBookingsApi.updateStatus(row.id, decision);
      const nextStatus = String(updated.status || decision).toLowerCase();
      setItems((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated, status: nextStatus } : r)));
      await refreshCounts();
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Update failed");
    } finally {
      setActionId(null);
    }
  }

  async function submitCompletion(photoUrl: string, notes: string, otp: string) {
    if (!completeRow) return;
    setActionId(completeRow.id);
    setErr("");
    try {
      await vendorBookingsApi.submitCompletionProof(completeRow.id, [photoUrl], notes || undefined);
      const updated = await vendorBookingsApi.verifyCompletionOtp(completeRow.id, otp);
      const nextStatus = String(updated.status || "completion_pending_confirmation").toLowerCase();
      setItems((prev) => prev.map((r) => (r.id === completeRow.id ? { ...r, ...updated, status: nextStatus } : r)));
      setCompleteRow(null);
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
                  onCancel={(r) => void review(r, "cancelled")}
                  onComplete={(r) => setCompleteRow(r)}
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
                  onCancel={(r) => void review(r, "cancelled")}
                  onComplete={(r) => setCompleteRow(r)}
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
                  onCancel={(r) => void review(r, "cancelled")}
                  onComplete={(r) => setCompleteRow(r)}
                />
              ))}
            </>
          ) : null}
        </div>
      )}

      <CompletionProofDialog
        open={!!completeRow}
        busy={actionId === completeRow?.id}
        onClose={() => setCompleteRow(null)}
        onSubmit={(url, notes, otp) => void submitCompletion(url, notes, otp)}
      />
    </VendorListLayout>
  );
}
