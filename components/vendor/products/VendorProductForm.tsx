"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  vendorCatalogApi,
  type CatalogProductRow,
  type MergedCategory,
  type ProductAttributeRow,
  type TaxConfigurationRow,
} from "@/lib/api/vendorCatalog";
import { vendorUploadImage } from "@/lib/api/vendorUpload";

function parseMeta(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function normalizeAttrSelections(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  return Object.entries(raw as Record<string, unknown>).reduce((acc, [k, v]) => {
    if (Array.isArray(v)) {
      acc[k] = v.map((x) => String(x)).filter(Boolean);
      return acc;
    }
    if (v == null || v === "") {
      acc[k] = [];
      return acc;
    }
    acc[k] = [String(v)];
    return acc;
  }, {} as Record<string, string[]>);
}

function selectValuesList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function splitLabelAndHex(value: string) {
  const s = String(value || "").trim();
  const m = s.match(/^(.*?)(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))$/);
  if (!m) return { label: s, hex: null as string | null };
  const label = String(m[1] || "").trim();
  return { label: label || s, hex: m[2] };
}

function resolvePublicAssetUrl(u: string) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY_URL || "").replace(/\/$/, "");
  if (base) return `${base}${u.startsWith("/") ? u : `/${u}`}`;
  return u;
}

type TabKey = "general" | "pricing" | "attributes";

export function VendorProductForm({
  mode,
  productId,
}: {
  mode: "create" | "edit";
  productId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [categories, setCategories] = useState<MergedCategory[]>([]);
  const [taxItems, setTaxItems] = useState<TaxConfigurationRow[]>([]);
  const [attributeDefs, setAttributeDefs] = useState<ProductAttributeRow[]>([]);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productType, setProductType] = useState("simple");
  const [availability, setAvailability] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [quantity, setQuantity] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [taxConfigurationId, setTaxConfigurationId] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [discountType, setDiscountType] = useState("Fixed");
  const [maxPointsRedeemable, setMaxPointsRedeemable] = useState("");
  const [maxUserRedemptionPercent, setMaxUserRedemptionPercent] = useState("");
  const [vendorCommissionLabel, setVendorCommissionLabel] = useState("Vendor default");
  const [commissionOverridePercent, setCommissionOverridePercent] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [dealOfDay, setDealOfDay] = useState("No");
  const [specVolume, setSpecVolume] = useState("");
  const [specPackSize, setSpecPackSize] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbUploading, setThumbUploading] = useState(false);
  const [moderationStatus, setModerationStatus] = useState<string>("approved");
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});

  const rootCategories = useMemo(
    () => categories.filter((c) => c.parentId == null),
    [categories],
  );
  const subcategories = useMemo(() => {
    if (!parentCategoryId) return [];
    return categories.filter((c) => c.parentId === parentCategoryId);
  }, [categories, parentCategoryId]);

  const displaySellingPrice = useMemo(() => {
    const fpRaw = String(finalPrice ?? "").trim();
    const fp = Number(fpRaw);
    if (fpRaw !== "" && Number.isFinite(fp)) return fp;
    const spRaw = String(sellPrice ?? "").trim();
    const sp = Number(spRaw);
    if (spRaw !== "" && Number.isFinite(sp)) return sp;
    return 0;
  }, [finalPrice, sellPrice]);

  const applyProduct = useCallback((row: CatalogProductRow) => {
    const meta = parseMeta(row.metadata);
    const attrs = normalizeAttrSelections(meta.productAttributes ?? meta.attributes);
    setSelectedAttributes(attrs);
    setName(row.name || "");
    setSku(String(meta.sku || ""));
    setCategoryId(row.categoryId || "");
    setProductType(String(meta.productType || "simple"));
    setAvailability(row.availability !== false);
    setIsActive(row.isActive !== false);
    setQuantity(meta.quantity != null ? String(meta.quantity) : "");
    setSellPrice(row.sellPrice != null ? String(row.sellPrice) : "");
    setDiscountAmount(row.discountAmount != null ? String(row.discountAmount) : "");
    setFinalPrice(row.finalPrice != null ? String(row.finalPrice) : "");
    setTaxConfigurationId(row.taxConfigurationId || "");
    setHsnCode(String(meta.hsnCode || ""));
    setTaxAmount(meta.taxAmount != null ? String(meta.taxAmount) : "");
    setDiscountType(String(meta.discountType || "Fixed"));
    setMaxPointsRedeemable(meta.maxPointsRedeemable != null ? String(meta.maxPointsRedeemable) : "");
    setMaxUserRedemptionPercent(
      meta.maxUserRedemptionPercent != null ? String(meta.maxUserRedemptionPercent) : "",
    );
    setVendorCommissionLabel(String(meta.vendorCommissionLabel || "Vendor default"));
    setCommissionOverridePercent(
      row.commissionOverridePercent != null ? String(row.commissionOverridePercent) : "",
    );
    setShortDescription(row.shortDescription || "");
    setLongDescription(row.longDescription || "");
    setDealOfDay(String(meta.dealOfDay || "No"));
    setSpecVolume(String(meta.specVolume || ""));
    setSpecPackSize(String(meta.specPackSize || ""));
    setThumbnailUrl(row.thumbnailUrl || "");
    setModerationStatus(String((row as CatalogProductRow).moderationStatus || "approved"));
  }, []);

  useEffect(() => {
    if (!categoryId || !categories.length) return;
    const chosen = categories.find((c) => c.id === categoryId);
    if (chosen?.parentId) setParentCategoryId(chosen.parentId);
  }, [categoryId, categories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [cRes, tRes, aRes] = await Promise.all([
          vendorCatalogApi.listCategoriesForProducts(),
          vendorCatalogApi.listTaxConfigurations(),
          vendorCatalogApi.listProductAttributes(),
        ]);
        if (cancelled) return;
        setCategories(cRes.items || []);
        setTaxItems(tRes.items || []);
        setAttributeDefs((aRes.items || []).filter((a) => a.isActive !== false));
        if (mode === "edit" && productId) {
          const row = await vendorCatalogApi.getProduct(productId);
          if (cancelled) return;
          applyProduct(row);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, productId, applyProduct]);

  function toggleSelectAttribute(attrName: string, option: string) {
    setSelectedAttributes((prev) => {
      const curr = Array.isArray(prev[attrName]) ? prev[attrName] : [];
      const next = curr.includes(option) ? curr.filter((v) => v !== option) : [...curr, option];
      return { ...prev, [attrName]: next };
    });
  }

  function setScalarAttribute(attrName: string, value: string) {
    setSelectedAttributes((prev) => ({
      ...prev,
      [attrName]: value ? [value] : [],
    }));
  }

  async function onThumbnailFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setThumbUploading(true);
    setErr("");
    try {
      const url = await vendorUploadImage(file);
      setThumbnailUrl(url);
    } catch (ex: unknown) {
      setErr(
        ex && typeof ex === "object" && "message" in ex
          ? String((ex as { message: string }).message)
          : "Upload failed",
      );
    } finally {
      setThumbUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Title is required.");
      setTab("general");
      return;
    }
    if (!parentCategoryId.trim()) {
      setErr("Select a category.");
      setTab("general");
      return;
    }
    if (!categoryId.trim()) {
      setErr("Select a subcategory.");
      setTab("general");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const sell = sellPrice.trim() || "0";
      const fin = finalPrice.trim() || sell;
      const body = {
        name: name.trim(),
        availability,
        categoryId: categoryId.trim() || null,
        serviceId: null,
        sellPrice: sell,
        discountAmount: discountAmount.trim() || "0",
        finalPrice: fin,
        taxConfigurationId: taxConfigurationId.trim() || null,
        commissionOverridePercent:
          commissionOverridePercent.trim() === ""
            ? null
            : (() => {
                const n = Number(commissionOverridePercent);
                return Number.isFinite(n) ? n : null;
              })(),
        shortDescription: shortDescription.trim() || null,
        longDescription: longDescription.trim() || null,
        thumbnailUrl: thumbnailUrl.trim() || null,
        isActive,
        price: sell,
        metadata: {
          sku: sku.trim() || null,
          productType: productType || "simple",
          hsnCode: hsnCode.trim() || null,
          taxAmount: taxAmount.trim() || null,
          discountType: discountType || null,
          quantity: quantity.trim() === "" ? null : Number(quantity),
          maxPointsRedeemable: maxPointsRedeemable.trim() || null,
          maxUserRedemptionPercent: maxUserRedemptionPercent.trim() || null,
          vendorCommissionLabel: vendorCommissionLabel.trim() || null,
          dealOfDay: dealOfDay || "No",
          specVolume: specVolume.trim() || null,
          specPackSize: specPackSize.trim() || null,
          productAttributes: selectedAttributes,
        },
      };
      if (mode === "create") {
        await vendorCatalogApi.createProduct(body);
      } else if (productId) {
        await vendorCatalogApi.patchProduct(productId, body);
      }
      router.push("/dashboard/product/products");
      router.refresh();
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[14px] border border-slate-100 bg-white p-10 text-center text-slate-600 shadow-sm">
        Loading form…
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      {moderationStatus === "pending" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This product is <strong>pending admin approval</strong>. You can edit details below; it will appear in the public
          catalog only after an administrator approves it. Availability and listing active flags are locked until then.
        </div>
      ) : null}

      {mode === "edit" && productId ? (
        <p className="text-sm text-slate-500">
          Product ref: <span className="font-mono font-medium text-slate-800">PRD-{productId.slice(-6)}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {(
          [
            ["general", "General"],
            ["pricing", "Pricing"],
            ["attributes", "Attributes"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === k ? "bg-white text-[#20a090] shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="grid gap-4 rounded-[14px] border border-slate-100 bg-white p-6 shadow-sm md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Title *</span>
            <input
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">SKU</span>
            <input className="input w-full" value={sku} onChange={(e) => setSku(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Product type</span>
            <select className="input w-full" value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="simple">simple</option>
              <option value="variable">variable</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Category *</span>
            <select
              className="input w-full"
              value={parentCategoryId}
              onChange={(e) => {
                setParentCategoryId(e.target.value);
                setCategoryId("");
              }}
            >
              <option value="">Select category</option>
              {rootCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Subcategory *</span>
            <select
              className="input w-full"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!parentCategoryId}
            >
              <option value="">{parentCategoryId ? "Select subcategory" : "Select category first"}</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Quantity (stock)</span>
            <input
              className="input w-full"
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Spec volume</span>
            <input className="input w-full" value={specVolume} onChange={(e) => setSpecVolume(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Spec pack size</span>
            <input className="input w-full" value={specPackSize} onChange={(e) => setSpecPackSize(e.target.value)} />
          </label>
          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={availability}
              disabled={moderationStatus === "pending"}
              onChange={(e) => setAvailability(e.target.checked)}
            />
            <span className="text-sm text-slate-700">Available for sale</span>
          </label>
          <label className="flex items-center gap-3 md:col-span-2">
            <input
              type="checkbox"
              checked={isActive}
              disabled={moderationStatus === "pending"}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="text-sm text-slate-700">Active listing (visible in catalog when approved)</span>
          </label>
          <div className="block space-y-2 md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Product images</span>
            <input
              type="file"
              accept="image/*"
              className="input w-full max-w-md py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-800"
              disabled={thumbUploading}
              onChange={(e) => void onThumbnailFileChange(e)}
            />
            <div className="flex flex-wrap items-center gap-3">
              {thumbUploading ? <span className="text-xs text-slate-600">Uploading…</span> : null}
              {thumbnailUrl ? (
                <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setThumbnailUrl("")}>
                  Remove image
                </button>
              ) : null}
            </div>
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvePublicAssetUrl(thumbnailUrl)}
                alt=""
                className="mt-2 h-24 w-24 rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <p className="text-xs text-slate-500">JPEG, PNG, WebP, GIF, or SVG — up to 8 MB.</p>
            )}
          </div>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Short description</span>
            <textarea className="input w-full min-h-[88px]" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={3} />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Long description</span>
            <textarea className="input w-full min-h-[88px]" value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={3} />
          </label>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 md:col-span-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Deal of the Day</p>
              <p className="text-xs text-slate-600">Featured in homepage deals (subject to admin rules)</p>
            </div>
            <select className="input w-36" value={dealOfDay} onChange={(e) => setDealOfDay(e.target.value)}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>
        </div>
      )}

      {tab === "pricing" && (
        <div className="space-y-4 rounded-[14px] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">MRP (₹)</span>
              <input className="input w-full" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Tax slab</span>
              <select
                className="input w-full"
                value={taxConfigurationId}
                onChange={(e) => setTaxConfigurationId(e.target.value)}
              >
                <option value="">Select tax</option>
                {taxItems.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || t.code} ({t.percentage}%)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">HSN code</span>
              <input className="input w-full" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Tax amount (reference)</span>
              <input className="input w-full" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Discount type</span>
              <select className="input w-full" value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                <option value="Fixed">Fixed</option>
                <option value="Percent">Percent</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Discount (₹ or %)</span>
              <input className="input w-full" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Final selling price (₹)</span>
              <input className="input w-full" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} placeholder="Leave blank to use MRP" />
            </label>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-lg font-semibold text-slate-800">Selling price</span>
            <span className="text-2xl font-bold text-slate-900">
              ₹{displaySellingPrice.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Max points redeemable</span>
              <input className="input w-full" value={maxPointsRedeemable} onChange={(e) => setMaxPointsRedeemable(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Max user redemption %</span>
              <input className="input w-full" value={maxUserRedemptionPercent} onChange={(e) => setMaxUserRedemptionPercent(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Vendor to P4U commission label</span>
              <input className="input w-full" value={vendorCommissionLabel} onChange={(e) => setVendorCommissionLabel(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Commission override % (this product)</span>
              <input
                className="input w-full"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={commissionOverridePercent}
                onChange={(e) => setCommissionOverridePercent(e.target.value)}
                placeholder="Blank = use plan/category"
              />
            </label>
          </div>
        </div>
      )}

      {tab === "attributes" && (
        <div className="rounded-[14px] border border-slate-100 bg-white p-6 shadow-sm">
          {attributeDefs.length === 0 ? (
            <p className="text-sm text-slate-500">No active product attributes.</p>
          ) : (
            <div className="space-y-6">
              {attributeDefs.map((attr) => {
                const values = selectValuesList(attr.selectValues);
                const selected = Array.isArray(selectedAttributes[attr.name]) ? selectedAttributes[attr.name] : [];
                return (
                  <div key={attr.id}>
                    <p className="mb-2 text-sm font-semibold text-slate-800">{attr.name}</p>
                    {attr.type === "select" ? (
                      <div className="flex flex-wrap gap-2">
                        {values.map((opt) => {
                          const { label, hex } = splitLabelAndHex(opt);
                          const active = selected.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleSelectAttribute(attr.name, opt)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                                active
                                  ? "border-[#20a090] bg-[#20a090]/10 text-teal-900"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              {hex ? (
                                <span
                                  className="h-4 w-4 rounded-full border border-slate-200"
                                  style={{ backgroundColor: hex }}
                                />
                              ) : null}
                              {label || opt}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        className="input w-full max-w-md"
                        type={attr.type === "number" ? "number" : "text"}
                        value={selected[0] || ""}
                        onChange={(e) => setScalarAttribute(attr.name, e.target.value)}
                        placeholder={`Enter ${attr.name}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/dashboard/product/products" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#20a090] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#188a7c] disabled:opacity-60"
        >
          {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
