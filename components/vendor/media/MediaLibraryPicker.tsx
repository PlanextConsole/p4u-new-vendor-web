"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ImageIcon, Search, Upload, X } from "lucide-react";
import { vendorMediaApi, type VendorMediaAsset, type VendorMediaFolder } from "@/lib/api/vendorMedia";
import { resolveMediaUrl } from "@/lib/media";

/**
 * Reusable "pick from Media Library" modal. Browses the vendor's existing image
 * assets (so the same image isn't uploaded twice), supports folder filtering,
 * and allows uploading a new image inline. Returns the stored relative URL.
 */
export default function MediaLibraryPicker({
  open,
  onClose,
  onSelect,
  title = "Choose from Media Library",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  title?: string;
}) {
  const [folders, setFolders] = useState<VendorMediaFolder[]>([]);
  const [assets, setAssets] = useState<VendorMediaAsset[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [folderRes, assetRes] = await Promise.all([
        vendorMediaApi.listFolders(),
        vendorMediaApi.searchAssets({ type: "images", limit: 200, offset: 0 }),
      ]);
      setFolders(folderRes.items || []);
      setAssets(assetRes.items || []);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const images = useMemo(() => {
    const t = q.trim().toLowerCase();
    return assets.filter(
      (a) =>
        a.mimeType.startsWith("image/") &&
        (activeFolder === "all" || a.folderId === activeFolder) &&
        (!t || a.originalName.toLowerCase().includes(t)),
    );
  }, [assets, q, activeFolder]);

  async function ensureUploadFolder(): Promise<string> {
    if (activeFolder !== "all") return activeFolder;
    if (folders[0]?.id) return folders[0].id;
    const created = await vendorMediaApi.createFolder("Library");
    setFolders((prev) => [created, ...prev]);
    return created.id;
  }

  async function uploadAndSelect(file: File) {
    setUploading(true);
    setErr("");
    try {
      const folderId = await ensureUploadFolder();
      const row = await vendorMediaApi.uploadToFolder(folderId, file);
      setAssets((prev) => [row, ...prev]);
      onSelect(row.url);
      onClose();
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="media-picker-title" className="text-lg font-bold text-foreground">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" aria-hidden />
              {uploading ? "Uploading…" : "Upload new"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadAndSelect(file);
            }}
          />
        </div>

        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search images…"
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {folders.length > 0 ? (
            <select
              value={activeFolder}
              onChange={(e) => setActiveFolder(e.target.value)}
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              aria-label="Filter by folder"
            >
              <option value="all">All folders</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {err ? <p className="mb-3 text-sm text-destructive">{err}</p> : null}
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading media…</p>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" aria-hidden />
              <p className="mt-3 text-sm font-medium">No images yet. Use “Upload new” to add one.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(a.url);
                      onClose();
                    }}
                    className="group relative block w-full overflow-hidden rounded-xl border border-border bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <span className="block aspect-square">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveMediaUrl(a.url) || a.url}
                        alt={a.originalName}
                        className="h-full w-full object-cover transition group-hover:opacity-90"
                      />
                    </span>
                    <span className="absolute inset-0 hidden items-center justify-center bg-primary/20 group-hover:flex">
                      <span className="rounded-full bg-primary p-2 text-white">
                        <Check className="h-4 w-4" />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
