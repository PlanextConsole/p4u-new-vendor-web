"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileImage, ImageIcon, IndianRupee, MoreVertical, Plus, Search, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import MediaLibraryPicker from "@/components/vendor/media/MediaLibraryPicker";

const PRICE_TYPES: { value: PriceType; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "starting_from", label: "Starting from" },
  { value: "hourly", label: "Hourly" },
];

const YES_NO = ["Yes", "No"] as const;

function mediaUrl(u: string) {
  return resolveMediaUrl(u) || u;
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
  categoryId: string;
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
  categoryId: "",
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
  const price = String(row.price ?? "");
  return {
    categoryId: row.categoryId || "",
    serviceId: row.serviceId,
    price,
    isActive: row.isActive,
    availability: row.isAvailable ? "Yes" : "No",
    displayName: metaStr(m, "displayName"),
    description: metaStr(m, "vendorDescription") || row.catalogDescription || "",
    iconUrl: metaStr(m, "vendorIconUrl") || row.catalogIconUrl || "",
    trending: m.trending === true ? "Yes" : "No",
    emergency: m.emergency === true ? "Yes" : "No",
    basePrice: metaStr(m, "referenceBasePrice") || price,
    priceType: (metaStr(m, "priceType") as PriceType) || "fixed",
    duration: metaStr(m, "duration"),
    city: metaStr(m, "city"),
  };
}

function bodyFromForm(f: FormState, opts: { includeServiceId: boolean }) {
  const basePrice = f.basePrice.trim();
  return {
    ...(opts.includeServiceId ? { serviceId: f.serviceId } : {}),
    price: basePrice,
    isActive: f.isActive,
    isAvailable: f.availability === "Yes",
    displayName: f.displayName.trim() || null,
    description: f.description.trim() || null,
    iconUrl: f.iconUrl.trim() || null,
    trending: f.trending === "Yes",
    emergency: f.emergency === "Yes",
    basePrice: basePrice || null,
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
  const [activeTab, setActiveTab] = useState<"general" | "pricing" | "descriptions">("general");
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);

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

  const catalogForCategory = useMemo(() => {
    if (!form.categoryId) return [];
    return catalog.filter((c) => c.serviceCategoryId === form.categoryId);
  }, [catalog, form.categoryId]);

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
    setActiveTab("general");
    setModal("add");
  }

  function openEdit(row: VendorServiceOfferingRow) {
    setEditingId(row.id);
    setEditingListingPending(String(row.moderationStatus || "approved").toLowerCase() === "pending");
    setForm(formFromRow(row));
    setActiveTab("general");
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

  function goToNextTab() {
    if (activeTab === "general") setActiveTab("pricing");
    else if (activeTab === "pricing") setActiveTab("descriptions");
  }
  async function submitForm() {
    if (!form.categoryId.trim() && modal === "add") {
      setErr("Select service category.");
      return;
    }
    if (!form.serviceId.trim() && modal === "add") {
      setErr("Select subcategory.");
      return;
    }
    if (!form.displayName.trim()) {
      setErr("Enter service title.");
      return;
    }
    if (!form.basePrice.trim()) {
      setErr("Enter base price.");
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
      <div className="min-w-0 space-y-4 py-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-12 rounded-xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!isServiceVendor) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
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
            <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
              {items.length} listing{items.length === 1 ? "" : "s"}
            </p>
          ) : null}
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Admin approving your <strong className="font-semibold text-foreground">service vendor</strong> account does
            not create listings here. Each row is a <strong className="font-semibold text-foreground">link</strong> between
            your business and a catalog service template - use <strong className="font-semibold text-foreground">Add Service</strong>{" "}
            to choose a template, set your price, and submit for review when required.
          </p>
        </div>
        <Button type="button" onClick={() => openAdd()} className="shrink-0 gap-2 self-start">
          <Plus className="h-4 w-4" aria-hidden />
          Add Service
        </Button>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services..."
            className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="appearance-none rounded-xl border border-border bg-card py-3 pl-4 pr-10 text-sm font-semibold text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            aria-label="Status filter"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending approval</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">v</span>
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
              className="relative flex gap-4 rounded-2xl border border-border bg-card p-4  sm:p-5"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground ring-1 ring-border/80">
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
                  <h2 className="text-base font-bold text-foreground sm:text-lg">{title}</h2>
                  {pendingMod ? (
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning ring-1 ring-warning/20/80">
                      pending approval
                    </span>
                  ) : null}
                  {!pendingMod && !row.isActive ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold capitalize text-destructive ring-1 ring-destructive/20/80">
                      inactive
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-base font-semibold text-foreground">{formatInr(priceNum)}</p>
                {(duration || city) && <p className="mt-1 text-sm text-muted-foreground">{[duration, city].filter(Boolean).join(" - ")}</p>}
              </div>
              <div className="relative shrink-0" ref={menuOpenId === row.id ? menuRef : undefined}>
                <button
                  type="button"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="More actions"
                  onClick={() => setMenuOpenId((id) => (id === row.id ? null : row.id))}
                >
                  <MoreVertical className="h-5 w-5" aria-hidden />
                </button>
                {menuOpenId === row.id ? (
                  <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-foreground hover:bg-muted"
                      onClick={() => openEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={pendingMod}
                      title={pendingMod ? "Awaiting admin approval" : undefined}
                      onClick={() => void toggleActive(row)}
                    >
                      {row.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
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
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-muted-foreground">
          {items.length === 0 ? (
            <>
              <p className="text-base font-medium text-foreground">No linked services yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Seeing your business on the admin &quot;Service vendors&quot; list only means your vendor profile exists.
                To appear in customer search and bookings, add at least one catalog service with{" "}
                <span className="font-semibold text-foreground">Add Service</span>.
              </p>
            </>
          ) : (
            "No services match your search or status filter."
          )}
        </div>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-0 sm:p-6"
          onClick={() => !saving && setModal(null)}
          role="presentation"
        >
          <div
            className="max-h-screen w-full overflow-y-auto bg-card p-6 shadow-2xl sm:max-h-[min(92vh,900px)] sm:max-w-6xl sm:rounded-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="svc-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Wrench className="h-7 w-7" aria-hidden />
                </span>
                <h2 id="svc-modal-title" className="text-lg font-bold text-foreground">
                  {modal === "add" ? "New Service" : "Edit Service"}
                </h2>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
                disabled={saving}
                onClick={() => setModal(null)}
              >
                <X className="h-7 w-7" aria-hidden />
              </button>
            </div>

            {editingListingPending ? (
              <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
                This listing is pending admin approval. It will reflect on the user service flow after admin approval.
              </div>
            ) : null}

            <div className="mt-6 flex rounded-2xl bg-muted p-2">
              {[
                ["general", "General"],
                ["pricing", "Pricing & Slots"],
                ["descriptions", "Descriptions"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`rounded-xl px-5 py-3 text-sm font-bold transition ${activeTab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setActiveTab(key as "general" | "pricing" | "descriptions")}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {activeTab === "general" ? (
                <section className="space-y-6">
                  <div className="rounded-2xl border border-border bg-muted/20 p-5">
                    <h3 className="flex items-center gap-2 text-2xl font-bold text-cyan-700">
                      <ImageIcon className="h-6 w-6" aria-hidden />
                      Service Image
                    </h3>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <label className="inline-flex cursor-pointer items-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted">
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={iconUploading || saving}
                          onChange={(ev) => void onServiceIconFile(ev)}
                        />
                        {iconUploading ? "Uploading..." : "Choose file"}
                      </label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground hover:bg-muted"
                        disabled={saving}
                        onClick={() => setMediaLibraryOpen(true)}
                      >
                        <FileImage className="h-4 w-4" aria-hidden />
                        Media Library
                      </button>
                      {form.iconUrl ? (
                        <button
                          type="button"
                          className="rounded-xl border border-destructive/30 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"
                          disabled={saving}
                          onClick={() => setForm((f) => ({ ...f, iconUrl: "" }))}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="mt-4 flex min-h-44 w-full items-center justify-center rounded-2xl border border-dashed border-cyan-200 bg-card text-center text-muted-foreground"
                      disabled={saving}
                      onClick={() => setMediaLibraryOpen(true)}
                    >
                      {form.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mediaUrl(form.iconUrl)} alt="" className="max-h-40 rounded-xl object-cover" />
                      ) : (
                        <span>
                          <ImageIcon className="mx-auto mb-2 h-6 w-6" aria-hidden />
                          <span className="block font-medium">Upload Service Image</span>
                          <span className="mt-2 block text-sm">Click to open Media Library</span>
                        </span>
                      )}
                    </button>
                    <MediaLibraryPicker
                      open={mediaLibraryOpen}
                      onClose={() => setMediaLibraryOpen(false)}
                      onSelect={(url) => setForm((f) => ({ ...f, iconUrl: url }))}
                    />
                  </div>

                  <label className="block">
                    <span className="text-sm font-bold text-muted-foreground">Title *</span>
                    <input
                      className="mt-2 w-full rounded-xl border border-border px-5 py-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      value={form.displayName}
                      onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                      placeholder="Service name"
                      maxLength={255}
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-bold text-muted-foreground">Service category *</span>
                      <select
                        className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted"
                        value={form.categoryId}
                        disabled={modal === "edit"}
                        onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value, serviceId: "" }))}
                      >
                        <option value="">Select category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-muted-foreground">Subcategory *</span>
                      <select
                        className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-muted"
                        value={form.serviceId}
                        disabled={modal === "edit" || !form.categoryId}
                        onChange={(e) => {
                          const serviceId = e.target.value;
                          const item = catalog.find((c) => c.id === serviceId);
                          const meta = item?.metadata || {};
                          setForm((f) => ({
                            ...f,
                            serviceId,
                            displayName: item?.name || f.displayName,
                            description: item?.description || f.description,
                            iconUrl: item?.iconUrl || f.iconUrl,
                            basePrice: item?.basePrice != null ? String(item.basePrice) : f.basePrice,
                            price: item?.basePrice != null ? String(item.basePrice) : f.price,
                            availability: item?.availability ? "Yes" : f.availability,
                            trending: item?.trending ? "Yes" : f.trending,
                            emergency: meta.emergency === true ? "Yes" : f.emergency,
                            priceType: meta.priceType === "starting_from" || meta.priceType === "hourly" || meta.priceType === "fixed" ? meta.priceType : f.priceType,
                            duration: typeof meta.duration === "string" ? meta.duration : f.duration,
                          }));
                        }}
                      >
                        <option value="">{form.categoryId ? "Select subcategory" : "Select category first"}</option>
                        {catalogForCategory.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="text-sm font-bold text-muted-foreground">Availability</span>
                      <select className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.availability} disabled={editingListingPending} onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))}>
                        {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-muted-foreground">Trending</span>
                      <select className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.trending} onChange={(e) => setForm((f) => ({ ...f, trending: e.target.value }))}>
                        {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-muted-foreground">Emergency service</span>
                      <select className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.emergency} onChange={(e) => setForm((f) => ({ ...f, emergency: e.target.value }))}>
                        {YES_NO.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  </div>
                </section>
              ) : null}

              {activeTab === "pricing" ? (
                <section className="rounded-2xl border border-border bg-muted/20 p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <IndianRupee className="h-4 w-4" aria-hidden />
                    Base Pricing
                  </h3>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="text-sm font-bold text-muted-foreground">Base Price (â‚¹)</span>
                      <input className="mt-2 w-full rounded-xl border border-border px-5 py-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" inputMode="decimal" value={form.basePrice} onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value, price: e.target.value }))} placeholder="e.g. 499" />
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-muted-foreground">Price type</span>
                      <select className="mt-2 w-full rounded-xl border border-border bg-card px-4 py-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.priceType} onChange={(e) => setForm((f) => ({ ...f, priceType: e.target.value as PriceType }))}>
                        {PRICE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-bold text-muted-foreground">Duration</span>
                      <input className="mt-2 w-full rounded-xl border border-border px-5 py-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} placeholder="e.g. 1-2 hours" maxLength={64} />
                    </label>
                  </div>
                </section>
              ) : null}

              {activeTab === "descriptions" ? (
                <section className="rounded-2xl border border-border bg-muted/20 p-5">
                  <label className="block">
                    <span className="text-sm font-bold text-muted-foreground">Description</span>
                    <textarea className="mt-3 min-h-44 w-full rounded-xl border border-border px-5 py-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Service description..." />
                  </label>
                </section>
              ) : null}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" disabled={saving} onClick={() => setModal(null)} className="rounded-xl border border-border px-6 py-3 text-sm font-bold text-foreground hover:bg-muted">
                  Cancel
                </button>
                {activeTab !== "descriptions" ? (
                  <button type="button" disabled={saving} onClick={goToNextTab} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60">
                    Next
                  </button>
                ) : (
                  <button type="button" disabled={saving} onClick={() => void submitForm()} className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60">
                    {saving ? "Saving..." : modal === "add" ? "Create Service" : "Save"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
