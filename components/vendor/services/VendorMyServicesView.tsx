"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MoreVertical, Plus, Search, Wrench } from "lucide-react";
import { getVendorMe, type VendorProfile } from "@/lib/api/vendor";
import {
  vendorOfferedServicesApi,
  type CatalogServiceItemRow,
  type ServiceCategoryRow,
  type VendorServiceOfferingRow,
  type PriceType,
} from "@/lib/api/vendorOfferedServices";
import { vendorUploadImage } from "@/lib/api/vendorUpload";
import { formatInr } from "@/lib/vendor/profileDisplay";
import { resolveMediaUrl } from "@/lib/media";

const PRICE_TYPES: { value: PriceType; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "starting_from", label: "Starting from" },
  { value: "hourly", label: "Hourly" },
];

const YES_NO = ["Yes", "No"] as const;

function mediaUrl(u: string) {
  return resolveMediaUrl(u) || "";
}

function metaStr(m: Record<string, unknown> | null | undefined, k: string): string {
  if (!m) return "";
  const v = m[k];
  return typeof v === "string" ? v : "";
}

function displayTitle(row: VendorServiceOfferingRow): string {
  const m = row.metadata || {};
  return metaStr(m, "displayName") || row.catalogName;
}

function displayIcon(row: VendorServiceOfferingRow): string {
  const m = row.metadata || {};
  return metaStr(m, "vendorIconUrl") || row.catalogIconUrl || "";
}

function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Request failed.";
}

type StatusFilter = "all" | "active" | "inactive" | "pending";

type FormState = {
  serviceId: string;
  price: string;
  isActive: boolean;
  availability: string;
  displayName: string;
  description: string;
  iconUrl: string;
  trending: string;
  emergency: string;
  basePrice: string;
  priceType: PriceType;
  duration: string;
  city: string;
};

const emptyForm: FormState = {
  serviceId: "",
  price: "",
  isActive: true,
  availability: "Yes",
  displayName: "",
  description: "",
  iconUrl: "",
  trending: "No",
  emergency: "No",
  basePrice: "",
  priceType: "fixed",
  duration: "",
  city: "",
};

function formFromRow(row: VendorServiceOfferingRow): FormState {
  const m = row.metadata || {};
  return {
    serviceId: row.serviceId,
    price: String(row.price ?? ""),
    isActive: row.isActive,
    availability: row.isAvailable ? "Yes" : "No",
    displayName: metaStr(m, "displayName"),
    description: metaStr(m, "vendorDescription") || row.catalogDescription || "",
    iconUrl: metaStr(m, "vendorIconUrl") || row.catalogIconUrl || "",
    trending: m.trending === true ? "Yes" : "No",
    emergency: m.emergency === true ? "Yes" : "No",
    basePrice: metaStr(m, "referenceBasePrice"),
    priceType: (metaStr(m, "priceType") as PriceType) || "fixed",
    duration: metaStr(m, "duration"),
    city: metaStr(m, "city"),
  };
}

function bodyFromForm(f: FormState, opts: { includeServiceId: boolean }) {
  return {
    ...(opts.includeServiceId ? { serviceId: f.serviceId } : {}),
    price: f.price.trim(),
    isActive: f.isActive,
    isAvailable: f.availability === "Yes",
    displayName: f.displayName.trim() || null,
    description: f.description.trim() || null,
    iconUrl: f.iconUrl.trim() || null,
    trending: f.trending === "Yes",
    emergency: f.emergency === "Yes",
    basePrice: f.basePrice.trim() || null,
    priceType: f.priceType,
    duration: f.duration.trim() || null,
    city: f.city.trim() || null,
  };
}

export default function VendorMyServicesView() {
  const [me, setMe] = useState<VendorProfile | null>(null);
  const [items, setItems] = useState<VendorServiceOfferingRow[]>([]);
  const [categories, setCategories] = useState<ServiceCategoryRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogServiceItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingListingPending, setEditingListingPending] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [iconUploading, setIconUploading] = useState(false);

  const isServiceVendor = String(me?.vendorType || "").toUpperCase() === "SERVICE";

  const load = useCallback(async () => {
    setErr("");
    try {
      const profile = await getVendorMe();
      setMe(profile);
      if (String(profile.vendorType || "").toUpperCase() !== "SERVICE") {
        setItems([]);
        setCategories([]);
        setCatalog([]);
        return;
      }
      const [list, cats, catItems] = await Promise.all([
        vendorOfferedServicesApi.listOfferings(),
        vendorOfferedServicesApi.listServiceCategories(),
        vendorOfferedServicesApi.listCatalogServiceItems(),
      ]);
      setItems(list);
      setCategories(cats);
      setCatalog(catItems);
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const selectedCatalogItem = useMemo(
    () => catalog.find((c) => c.id === form.serviceId) ?? null,
    [catalog, form.serviceId],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((row) => {
      const title = displayTitle(row).toLowerCase();
      const mod = String(row.moderationStatus || "approved").toLowerCase();
      if (t && !title.includes(t)) return false;
      if (status === "pending" && mod !== "pending") return false;
      if (status === "active" && (mod === "pending" || !row.isActive)) return false;
      if (status === "inactive" && (mod === "pending" || row.isActive)) return false;
      return true;
    });
  }, [items, q, status]);

  function openAdd() {
    setEditingId(null);
    setEditingListingPending(false);
    setForm(emptyForm);
    setModal("add");
  }

  function openEdit(row: VendorServiceOfferingRow) {
    setEditingId(row.id);
    setEditingListingPending(String(row.moderationStatus || "approved").toLowerCase() === "pending");
    setForm(formFromRow(row));
    setModal("edit");
    setMenuOpenId(null);
  }

  async function onServiceIconFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIconUploading(true);
    setErr("");
    try {
      const url = await vendorUploadImage(file);
      setForm((f) => ({ ...f, iconUrl: url }));
    } catch (err: unknown) {
      setErr(errMessage(err));
    } finally {
      setIconUploading(false);
    }
  }

  async function submitForm() {
    if (!form.serviceId.trim() && modal === "add") {
      setErr("Select a catalog service.");
      return;
    }
    if (!form.price.trim()) {
      setErr("Enter your price (₹).");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      if (modal === "add") {
        await vendorOfferedServicesApi.create(
          bodyFromForm(form, { includeServiceId: true }) as Parameters<typeof vendorOfferedServicesApi.create>[0],
        );
      } else if (modal === "edit" && editingId) {
        await vendorOfferedServicesApi.patch(editingId, bodyFromForm(form, { includeServiceId: false }));
      }
      setModal(null);
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: VendorServiceOfferingRow) {
    if (String(row.moderationStatus || "approved").toLowerCase() === "pending") {
      setErr("This listing is pending admin approval. You cannot activate it until it is approved.");
      setMenuOpenId(null);
      return;
    }
    setMenuOpenId(null);
    setErr("");
    try {
      await vendorOfferedServicesApi.patch(row.id, { isActive: !row.isActive });
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  async function removeRow(id: string) {
    setMenuOpenId(null);
    if (!window.confirm("Remove this service from your listings?")) return;
    setErr("");
    try {
      await vendorOfferedServicesApi.delete(id);
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  if (loading) {
    return (
      <div className="flex min-w-0 items-center justify-center gap-2 py-20 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading services…
      </div>
    );
  }

  if (!isServiceVendor) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        My Services is only available for <strong>service</strong> vendors. Switch to the product dashboard if you sell
        physical goods.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {items.length > 0 ? (
            <p className="text-sm font-medium text-slate-600" aria-live="polite">
              {items.length} listing{items.length === 1 ? "" : "s"}
            </p>
          ) : null}
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
            Admin approving your <strong className="font-semibold text-slate-700">service vendor</strong> account does
            not create listings here. Each row is a <strong className="font-semibold text-slate-700">link</strong> between
            your business and a catalog service template — use <strong className="font-semibold text-slate-700">Add Service</strong>{" "}
            to choose a template, set your price, and submit for review when required.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openAdd()}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#20a090] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#188a7c]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add Service
        </button>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services…"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#20a090]/50 focus:ring-2 focus:ring-[#20a090]/20"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-800 outline-none focus:border-[#20a090]/50 focus:ring-2 focus:ring-[#20a090]/20"
            aria-label="Status filter"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending approval</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">▾</span>
        </div>
      </div>

      <ul className="space-y-4">
        {filtered.map((row) => {
          const m = row.metadata || {};
          const title = displayTitle(row);
          const icon = displayIcon(row);
          const duration = metaStr(m, "duration") || metaStr(row.catalogMetadata, "duration");
          const city = metaStr(m, "city");
          const priceNum = parseFloat(String(row.price || "0")) || 0;
          const pendingMod = String(row.moderationStatus || "approved").toLowerCase() === "pending";
          return (
            <li
              key={row.id}
              className="relative flex gap-4 rounded-[14px] border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-5"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/80">
                {icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(icon)}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Wrench className="h-7 w-7" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">{title}</h2>
                  {pendingMod ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80">
                      pending approval
                    </span>
                  ) : null}
                  {!pendingMod && !row.isActive ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold capitalize text-rose-700 ring-1 ring-rose-200/80">
                      inactive
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-base font-semibold text-slate-800">{formatInr(priceNum)}</p>
                {(duration || city) && <p className="mt-1 text-sm text-slate-500">{[duration, city].filter(Boolean).join(" · ")}</p>}
              </div>
              <div className="relative shrink-0" ref={menuOpenId === row.id ? menuRef : undefined}>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label="More actions"
                  onClick={() => setMenuOpenId((id) => (id === row.id ? null : row.id))}
                >
                  <MoreVertical className="h-5 w-5" aria-hidden />
                </button>
                {menuOpenId === row.id ? (
                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={pendingMod}
                      title={pendingMod ? "Awaiting admin approval" : undefined}
                      onClick={() => void toggleActive(row)}
                    >
                      {row.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      onClick={() => void removeRow(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-slate-600">
          {items.length === 0 ? (
            <>
              <p className="text-base font-medium text-slate-800">No linked services yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Seeing your business on the admin &quot;Service vendors&quot; list only means your vendor profile exists.
                To appear in customer search and bookings, add at least one catalog service with{" "}
                <span className="font-semibold text-slate-700">Add Service</span>.
              </p>
            </>
          ) : (
            "No services match your search or status filter."
          )}
        </div>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 sm:p-6"
          onClick={() => !saving && setModal(null)}
          role="presentation"
        >
          <div
            className="max-h-[min(92vh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="svc-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="svc-modal-title" className="text-xl font-bold text-slate-900">
              {modal === "add" ? "Add service" : "Edit service"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Matches admin catalog service fields: template name and category are fixed; you set price, overrides, and
              listing options. Your customer price is required below.
            </p>

            {editingListingPending ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                This listing is <strong>pending admin approval</strong>. You can edit details below; it appears in the public
                services catalog only after an administrator approves it. Availability and “listing active” are locked
                until then.
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className={modal === "edit" ? "sm:col-span-2 opacity-60" : "sm:col-span-2"}>
                <span className="text-sm font-semibold text-slate-800">Catalog service *</span>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20 disabled:cursor-not-allowed"
                  value={form.serviceId}
                  disabled={modal === "edit"}
                  onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {catalog.map((c) => {
                    const cn = c.serviceCategoryId ? categoryNameById.get(c.serviceCategoryId) || "—" : "—";
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({cn})
                      </option>
                    );
                  })}
                </select>
              </label>

              {selectedCatalogItem ? (
                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Catalog template (same as admin “service name” + category)
                  </p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{selectedCatalogItem.name}</p>
                  <p className="mt-1 text-slate-600">
                    Category:{" "}
                    <span className="text-slate-900">
                      {selectedCatalogItem.serviceCategoryId
                        ? categoryNameById.get(selectedCatalogItem.serviceCategoryId) || "—"
                        : "—"}
                    </span>
                  </p>
                  {selectedCatalogItem.description ? (
                    <p className="mt-3 max-h-28 overflow-y-auto whitespace-pre-wrap text-slate-600">
                      {selectedCatalogItem.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No catalog description on this template.</p>
                  )}
                  {selectedCatalogItem.basePrice != null && String(selectedCatalogItem.basePrice).trim() !== "" ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Catalog base price (reference): ₹{String(selectedCatalogItem.basePrice)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Display name (optional)</span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Overrides catalog name in your listings"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="text-sm font-semibold text-slate-800">Description</span>
                <textarea
                  className="mt-2 min-h-[100px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What the customer gets"
                />
              </label>

              <div className="sm:col-span-2 space-y-2">
                <span className="text-sm font-semibold text-slate-800">Icon / image</span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={iconUploading || saving}
                      onChange={(ev) => void onServiceIconFile(ev)}
                    />
                    {iconUploading ? "Uploading…" : "Choose image"}
                  </label>
                  {form.iconUrl ? (
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      disabled={saving}
                      onClick={() => setForm((f) => ({ ...f, iconUrl: "" }))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                {form.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(form.iconUrl)}
                    alt=""
                    className="mt-2 h-16 w-16 rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <p className="text-xs text-slate-500">Square image recommended — JPEG, PNG, WebP, up to 8 MB.</p>
                )}
              </div>

              <label>
                <span className="text-sm font-semibold text-slate-800">Your price (₹) *</span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="e.g. 499"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-800">Reference base price (optional)</span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  value={form.basePrice}
                  onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                  placeholder="Shown as reference only"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-800">Price type</span>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  value={form.priceType}
                  onChange={(e) => setForm((f) => ({ ...f, priceType: e.target.value as PriceType }))}
                >
                  {PRICE_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-800">Duration</span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="e.g. 1–2 hours"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-800">City / area</span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Coimbatore"
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-800">Availability</span>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                  value={form.availability}
                  disabled={editingListingPending}
                  onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}
                >
                  {YES_NO.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-800">Trending</span>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  value={form.trending}
                  onChange={(e) => setForm((f) => ({ ...f, trending: e.target.value }))}
                >
                  {YES_NO.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-sm font-semibold text-slate-800">Emergency service</span>
                <select
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/20"
                  value={form.emergency}
                  onChange={(e) => setForm((f) => ({ ...f, emergency: e.target.value }))}
                >
                  {YES_NO.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-[#20a090] focus:ring-[#20a090] disabled:cursor-not-allowed"
                  checked={form.isActive}
                  disabled={editingListingPending}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <span className="text-sm font-semibold text-slate-800">Listing active (visible when approved)</span>
              </label>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModal(null)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitForm()}
                className="rounded-xl bg-[#20a090] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#188a7c] disabled:opacity-60"
              >
                {saving ? "Saving…" : modal === "add" ? "Save" : "Update"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
