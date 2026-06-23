"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreVertical, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  VendorListEmpty,
  VendorListLayout,
  VendorListToolbar,
  VendorStatusBadge,
} from "@/components/vendor/VendorListUi";
import {
  vendorCatalogApi,
  type CatalogProductRow,
} from "@/lib/api/vendorCatalog";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media";

function parseMeta(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function mediaUrl(u: string) {
  return resolveMediaUrl(u) || u;
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
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

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

  const hasFilters = Boolean(qInput.trim() || filter !== "all");

  return (
    <VendorListLayout>
      <VendorListToolbar>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search products..." value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </div>
        <select
          className={cn(
            "h-10 w-[120px] shrink-0 rounded-xl border border-input bg-background px-3 text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "active" | "inactive")}
          aria-label="Product status"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={() => {
              setQInput("");
              setFilter("all");
            }}
          >
            Clear
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={exportCsv} className="shrink-0 gap-2">
          <Upload className="h-4 w-4" />
          CSV
        </Button>
        <Button asChild className="shrink-0 gap-2">
          <Link href="/dashboard/product/products/new">
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </VendorListToolbar>

      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <ul className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <VendorListEmpty
          title={hasFilters ? "No products found. Try clearing filters." : "No products found. Click Add Product to create one."}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const meta = parseMeta(p.metadata);
            const sku = String(meta.sku || "—");
            const qty = meta.quantity != null ? String(meta.quantity) : "—";
            const thumb = mediaUrl(p.thumbnailUrl || "");
            const pendingMod = String(p.moderationStatus || "approved").toLowerCase() === "pending";
            const statusLabel = pendingMod ? "inactive" : "active";
            return (
              <li key={p.id}>
                <Card className="relative flex items-center gap-4 p-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary/30">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg text-muted-foreground">📦</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <VendorStatusBadge status={statusLabel} kind="product" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ₹{Number(p.finalPrice || p.sellPrice || 0).toLocaleString("en-IN")} · Stock: {qty} ·{" "}
                      {(p.unitsSold ?? 0).toLocaleString("en-IN")} sold
                    </p>
                    <p className="text-[10px] text-muted-foreground">SKU {sku}</p>
                  </div>
                  <div className="relative ml-auto shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Product actions"
                      onClick={() => setMenuId((id) => (id === p.id ? null : p.id))}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    {menuId === p.id ? (
                      <Card className="absolute right-0 top-9 z-10 min-w-[140px] py-1 shadow-lg">
                        <Link
                          href={`/dashboard/product/products/${encodeURIComponent(p.id)}/edit`}
                          className="block px-4 py-2 text-sm hover:bg-muted"
                          onClick={() => setMenuId(null)}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                          onClick={() => void removeProduct(p.id)}
                        >
                          Delete
                        </button>
                      </Card>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </VendorListLayout>
  );
}
