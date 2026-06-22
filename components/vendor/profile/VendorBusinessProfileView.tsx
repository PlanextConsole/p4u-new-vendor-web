"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Crown,
  CreditCard,
  ImagePlus,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Pencil,
  Phone,
  Save,
  Shield,
  Store,
  X,
} from "lucide-react";
import { getVendorMe, patchVendorProfile, type VendorProfile } from "@/lib/api/vendor";
import { vendorPlanApi, type VendorPlanInfoDto } from "@/lib/api/vendorPlan";
import { vendorOrdersApi } from "@/lib/api/vendorOrders";
import { vendorCatalogApi } from "@/lib/api/vendorCatalog";
import {
  formatInr,
  formatPercent,
  latLngFromJson,
  pickFirstCategoryLabel,
  pickFirstServiceLabel,
  shopAddressFromJson,
} from "@/lib/vendor/profileDisplay";

function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong.";
}

function paymentPlanBadge(membershipStatus: string | null | undefined): { label: string; paid: boolean } {
  const m = String(membershipStatus || "").toLowerCase();
  if (m === "paid" || m === "active" || m === "completed") return { label: "Paid", paid: true };
  return { label: "unpaid", paid: false };
}

function mergeAddressJson(
  prev: Record<string, unknown> | null | undefined,
  shop: string,
  lat: string,
  lng: string,
): Record<string, unknown> {
  const base = prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
  base.areaLocality = shop.trim() || null;
  const la = lat.trim() === "" ? NaN : Number(lat);
  const ln = lng.trim() === "" ? NaN : Number(lng);
  if (!Number.isNaN(la)) base.latitude = la;
  else delete base.latitude;
  if (!Number.isNaN(ln)) base.longitude = ln;
  else delete base.longitude;
  return base;
}

export default function VendorBusinessProfileView() {
  const [me, setMe] = useState<VendorProfile | null>(null);
  const [planInfo, setPlanInfo] = useState<VendorPlanInfoDto | null>(null);
  const [productTotal, setProductTotal] = useState<number | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverUrlDraft, setCoverUrlDraft] = useState("");

  const [form, setForm] = useState({
    email: "",
    phone: "",
    shopAddress: "",
    lat: "",
    lng: "",
  });

  const readOnly = me?.source === "onboarding";
  const isProduct = String(me?.vendorType || "").toUpperCase() === "PRODUCT";

  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const profile = await getVendorMe();
      setMe(profile);

      if (profile.source === "catalog") {
        const [planRes, ordersRes] = await Promise.all([
          vendorPlanApi.get().catch(() => null),
          vendorOrdersApi.list({ limit: 100, offset: 0 }).catch(() => null),
        ]);
        setPlanInfo(planRes);

        if (ordersRes) {
          setOrderTotal(ordersRes.total);
          let sum = 0;
          for (const o of ordersRes.items) {
            sum += parseFloat(String(o.totalAmount || "0")) || 0;
          }
          setRevenue(sum);
        } else {
          setOrderTotal(0);
          setRevenue(0);
        }

        if (String(profile.vendorType || "").toUpperCase() === "PRODUCT") {
          const pr = await vendorCatalogApi.listProducts({ limit: 1, offset: 0, status: "all" }).catch(() => null);
          setProductTotal(pr?.total ?? 0);
        } else {
          const svcs = profile.servicesJson;
          setProductTotal(Array.isArray(svcs) ? svcs.length : 0);
        }
      } else {
        setPlanInfo(null);
        const svcs = profile.servicesJson;
        setProductTotal(Array.isArray(svcs) ? svcs.length : 0);
        setOrderTotal(0);
        setRevenue(0);
      }
    } catch (e: unknown) {
      setBanner(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit() {
    if (!me) return;
    const addr = me.addressJson;
    const { lat, lng } = latLngFromJson(addr);
    setForm({
      email: String(me.email || ""),
      phone: String(me.phone || ""),
      shopAddress: shopAddressFromJson(addr),
      lat,
      lng,
    });
    setEditOpen(true);
  }

  async function saveBusinessDetails() {
    if (!me || readOnly) return;
    setSaving(true);
    setBanner("");
    try {
      const addressJson = mergeAddressJson(me.addressJson, form.shopAddress, form.lat, form.lng);
      const updated = await patchVendorProfile({
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        addressJson,
      });
      setMe({ ...updated, source: "catalog" });
      setEditOpen(false);
    } catch (e: unknown) {
      setBanner(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveCoverUrl() {
    if (!me || readOnly) return;
    const url = coverUrlDraft.trim();
    setSaving(true);
    setBanner("");
    try {
      const updated = await patchVendorProfile({ bannerUrl: url || null });
      setMe({ ...updated, source: "catalog" });
      setCoverOpen(false);
      setCoverUrlDraft("");
    } catch (e: unknown) {
      setBanner(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setBanner("Location is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }));
      },
      () => setBanner("Could not read your location. Allow access or enter coordinates manually."),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  function openPickOnMap() {
    window.open("https://www.google.com/maps", "_blank", "noopener,noreferrer");
  }

  if (loading || !me) {
    return (
      <div className="flex min-w-0 items-center justify-center gap-2 py-20 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading profile…
      </div>
    );
  }

  const categoryOrService = isProduct ? pickFirstCategoryLabel(me.categoriesJson) : pickFirstServiceLabel(me.servicesJson);
  const subtitleParts = [me.ownerName, categoryOrService].filter(Boolean);
  const subtitle = subtitleParts.join(" • ") || me.ownerName || "—";

  const commissionDisplay = formatPercent(
    planInfo?.effective?.commissionPercent ?? (me as { commissionRate?: string }).commissionRate,
  );

  const planName = planInfo?.plan?.planName?.trim() || "Basic Plan";
  const planBlurb = planInfo?.plan
    ? `Tier ${planInfo.plan.tier} · ${planInfo.plan.planType}`
    : "Standard commission rates";
  const pay = paymentPlanBadge((me as { membershipStatus?: string | null }).membershipStatus);

  const verified = String(me.kycStatus || "").toLowerCase() === "verified";

  const thumb = String((me as { thumbnailUrl?: string | null }).thumbnailUrl || (me as { logoUrl?: string | null }).logoUrl || "");
  const bannerUrl = String((me as { bannerUrl?: string | null }).bannerUrl || "");

  const catalogCountLabel = isProduct ? "Products" : "Services";
  let catalogCount = 0;
  if (me.source === "catalog" && productTotal != null) catalogCount = productTotal;
  else if (!isProduct && Array.isArray(me.servicesJson)) catalogCount = me.servicesJson.length;
  else catalogCount = 0;

  return (
    <div className="min-w-0 space-y-6">
      {readOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Profile is pending approval. Details below reflect your application.{" "}
          <Link href="/onboarding" className="font-semibold text-[#0f766e] underline">
            Edit application
          </Link>
        </div>
      ) : null}
      {banner ? <p className="text-sm text-red-600">{banner}</p> : null}

      {/* Cover */}
      <div className="relative overflow-hidden rounded-[14px] border border-slate-100 bg-gradient-to-br from-[#20a090]/35 via-[#20a090]/15 to-slate-100 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
        <div className="relative h-44 w-full sm:h-52">
          {bannerUrl ? (
            <Image src={bannerUrl} alt="" fill className="object-cover" sizes="100vw" unoptimized />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" aria-hidden />
        </div>
        <button
          type="button"
          disabled={readOnly || saving}
          onClick={() => {
            setCoverUrlDraft(bannerUrl);
            setCoverOpen(true);
          }}
          className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur hover:bg-white disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4 text-[#20a090]" aria-hidden />
          Change Cover
        </button>
      </div>

      {/* Summary card */}
      <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#20a090]/15 text-[#20a090] ring-1 ring-[#20a090]/25">
            {thumb ? (
              <Image src={thumb} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized />
            ) : (
              <Store className="h-10 w-10" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{me.businessName || "—"}</h1>
              {verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  verified
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-base text-slate-600">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Business details */}
      <section className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Business Details</h2>
          <button
            type="button"
            disabled={readOnly || saving}
            onClick={() => openEdit()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </button>
        </div>
        <ul className="mt-5 space-y-5">
          <li className="flex gap-3">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">{me.email || "—"}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Phone</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">{me.phone || "—"}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Location</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">{shopAddressFromJson(me.addressJson) || "—"}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Commission Rate</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900">{commissionDisplay}</p>
            </div>
          </li>
        </ul>
      </section>

      {/* Plan & payment */}
      <section className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Crown className="h-5 w-5 text-[#20a090]" aria-hidden />
          Plan &amp; Payment
        </h2>
        <div className="mt-4 rounded-[12px] border border-[#20a090]/25 bg-[#20a090]/10 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-bold text-[#0f766e]">{planName}</p>
              <p className="mt-1 text-sm text-slate-600">{planBlurb}</p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                pay.paid ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" aria-hidden />
              {pay.label}
            </span>
          </div>
        </div>
      </section>

      {/* Performance */}
      <section className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-6">
        <h2 className="text-lg font-bold text-slate-900">Performance</h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{catalogCount}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">{catalogCountLabel}</p>
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{orderTotal}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">Orders</p>
          </div>
          <div>
            <p className="text-3xl font-bold tracking-tight text-slate-900">{formatInr(revenue)}</p>
            <p className="mt-1 text-sm font-medium text-slate-500">Revenue</p>
          </div>
        </div>
      </section>

      {/* Edit business details */}
      {editOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 sm:p-6"
          onClick={() => setEditOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[min(92vh,760px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="biz-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="biz-edit-title" className="text-xl font-bold text-slate-900">
                Business Details
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveBusinessDetails()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#20a090] px-4 py-2 text-sm font-semibold text-white hover:bg-[#188a7c] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" aria-hidden />
                  Save
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Email</span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Phone</span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Shop Address</span>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25"
                  value={form.shopAddress}
                  onChange={(e) => setForm((f) => ({ ...f, shopAddress: e.target.value }))}
                  autoComplete="street-address"
                />
              </label>
              <div>
                <span className="text-sm font-semibold text-slate-800">Exact Shop Coordinates (used for nearby search)</span>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25"
                    placeholder="Latitude"
                    value={form.lat}
                    onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                    inputMode="decimal"
                  />
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25"
                    placeholder="Longitude"
                    value={form.lng}
                    onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                    inputMode="decimal"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => useCurrentLocation()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Navigation className="h-4 w-4 text-[#20a090]" aria-hidden />
                    Use Current Location
                  </button>
                  <button
                    type="button"
                    onClick={() => openPickOnMap()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <MapPin className="h-4 w-4 text-[#20a090]" aria-hidden />
                    Pick on Map
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Tip: Open Google Maps, long-press your shop, and copy the lat,lng into the fields above.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {coverOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setCoverOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cover-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cover-title" className="text-lg font-bold text-slate-900">
              Cover image URL
            </h2>
            <p className="mt-1 text-sm text-slate-500">Paste a direct link to an image (HTTPS).</p>
            <input
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25"
              value={coverUrlDraft}
              onChange={(e) => setCoverUrlDraft(e.target.value)}
              placeholder="https://…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCoverOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveCoverUrl()}
                className="rounded-xl bg-[#20a090] px-4 py-2 text-sm font-semibold text-white hover:bg-[#188a7c] disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
