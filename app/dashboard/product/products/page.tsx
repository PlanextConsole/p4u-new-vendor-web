"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical, Plus, Search, Upload } from "lucide-react";
import {
  vendorCatalogApi,
  type CatalogProductRow,
} from "@/lib/api/vendorCatalog";

function parseMeta(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function mediaUrl(u: string) {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  const base = (process.env.NEXT_PUBLIC_API_GATEWAY_URL || "").replace(/\/$/, "");
  if (base) return `${base}${u.startsWith("/") ? u : `/${u}`}`;
  return u;
}

function toCsv(rows: CatalogProductRow[]) {
  const header = ["name", "sku", "sell_price", "quantity", "status", "id"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const m = parseMeta(r.metadata);
    const sku = String(m.sku || "");
    const qty = m.quantity != null ? String(m.quantity) : "";
    const pending = String(r.moderationStatus || "approved").toLowerCase() === "pending";
    const status = pending ? "inactive" : "active";
    lines.push(
      [r.name, sku, r.sellPrice, qty, status, r.id]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
  }
  return lines.join("\n");
}

export default function VendorProductsListPage() {
  const [items, setItems] = useState<CatalogProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  /** All | Active (admin-approved) | Inactive (pending approval). */
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const moderation =
        filter === "active" ? ("approved" as const) : filter === "inactive" ? ("pending" as const) : undefined;
      const res = await vendorCatalogApi.listProducts({
        q: q.trim() || undefined,
        moderation,
        limit: 100,
        offset: 0,
      });
      setItems(res.items || []);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const countLabel = useMemo(() => items.length, [items]);

  function exportCsv() {
    const blob = new Blob([toCsv(items)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function removeProduct(id: string) {
    if (!window.confirm("Delete this product? This cannot be undone.")) return;
    try {
      await vendorCatalogApi.deleteProduct(id);
      setMenuId(null);
      void load();
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Delete failed");
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {!loading ? (
          <p className="text-sm font-medium text-slate-600 lg:shrink-0" aria-live="polite">
            {countLabel === 1 ? "1 product" : `${countLabel} products`}
          </p>
        ) : null}
        <div className="flex min-w-0 w-full flex-1 flex-wrap items-center gap-2 lg:max-w-[720px] lg:justify-end">
          <div className="relative min-w-0 flex-1 basis-[min(100%,280px)]">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              className="input w-full py-2.5 !pl-12 pr-3"
              placeholder="Search products..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void load()}
            />
          </div>
          <select
            className="input min-w-[140px] shrink-0 py-2.5"
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "active" | "inactive")}
            aria-label="Product status"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            CSV
          </button>
          <Link
            href="/dashboard/product/products/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#20a090] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#188a7c]"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </div>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      {loading ? (
        <p className="text-slate-600">Loading products…</p>
      ) : items.length === 0 ? (
        <div className="rounded-[14px] border border-slate-100 bg-white p-14 text-center text-slate-600 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          No products yet.{" "}
          <Link href="/dashboard/product/products/new" className="font-semibold text-[#20a090] hover:underline">
            Add your first product
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const meta = parseMeta(p.metadata);
            const sku = String(meta.sku || "—");
            const qty = meta.quantity != null ? String(meta.quantity) : "—";
            const thumb = mediaUrl(p.thumbnailUrl || "");
            const pendingMod = String(p.moderationStatus || "approved").toLowerCase() === "pending";
            return (
              <li
                key={p.id}
                className="relative flex items-center gap-4 rounded-[14px] border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)]"
              >
                <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-900">{p.name}</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        pendingMod ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {pendingMod ? "Inactive" : "Active"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-1 sm:max-w-xl">
                    <span className="text-base font-semibold text-slate-900">
                      ₹{Number(p.finalPrice || p.sellPrice || 0).toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm text-slate-500">Stock: {qty}</span>
                    <span className="text-sm text-slate-500">0 sold</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">SKU {sku}</p>
                </div>
                <div className="relative ml-auto shrink-0 self-center">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Product actions"
                    onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {menuId === p.id ? (
                    <div className="absolute right-0 top-10 z-10 min-w-[140px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <Link
                        href={`/dashboard/product/products/${encodeURIComponent(p.id)}/edit`}
                        className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setMenuId(null)}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                        onClick={() => void removeProduct(p.id)}
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
      )}
    </div>
  );
}
