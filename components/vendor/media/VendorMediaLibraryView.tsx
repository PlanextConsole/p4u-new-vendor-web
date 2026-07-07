"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Folder, FolderInput, FolderPlus, ImageIcon, Search, Trash2, Upload } from "lucide-react";
import { vendorMediaApi, type VendorMediaAsset, type VendorMediaFolder } from "@/lib/api/vendorMedia";
import { resolveMediaUrl } from "@/lib/media";

type FileFilter = "all" | "images" | "documents";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(m: string): boolean {
  return m.startsWith("image/");
}

function isDocumentMime(m: string): boolean {
  const x = m.toLowerCase();
  return (
    x === "application/pdf" ||
    x.includes("word") ||
    x.includes("document") ||
    x.includes("sheet") ||
    x === "text/plain"
  );
}

function acceptFilter(kind: FileFilter, mime: string): boolean {
  if (kind === "all") return true;
  if (kind === "images") return isImageMime(mime);
  return isDocumentMime(mime);
}

function assetSize(asset: VendorMediaAsset): number {
  const n = Number(asset.sizeBytes);
  return Number.isFinite(n) ? n : 0;
}

export default function VendorMediaLibraryView() {
  const [folders, setFolders] = useState<VendorMediaFolder[]>([]);
  const [assets, setAssets] = useState<VendorMediaAsset[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [dragOver, setDragOver] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [moveAssetId, setMoveAssetId] = useState<string | null>(null);
  const [moveFolderId, setMoveFolderId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const type = fileFilter === "all" ? "all" : fileFilter;
      const [folderRes, assetRes] = await Promise.all([
        vendorMediaApi.listFolders(),
        vendorMediaApi.searchAssets({ type, limit: 200, offset: 0 }),
      ]);
      setFolders(folderRes.items || []);
      setAssets(assetRes.items || []);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load media");
      setFolders([]);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [fileFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFolder = useMemo(
    () => folders.find((f) => f.id === activeFolderId) || null,
    [folders, activeFolderId],
  );

  const filteredFiles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return assets.filter(
      (f) =>
        acceptFilter(fileFilter, f.mimeType) &&
        (activeFolderId == null || f.folderId === activeFolderId) &&
        (!t || f.originalName.toLowerCase().includes(t)),
    );
  }, [assets, q, fileFilter, activeFolderId]);

  const filteredFolders = useMemo(() => {
    const t = q.trim().toLowerCase();
    return folders.filter((f) => !t || f.name.toLowerCase().includes(t));
  }, [folders, q]);

  const folderFileCount = useCallback(
    (folderId: string) => assets.filter((a) => a.folderId === folderId).length,
    [assets],
  );

  // Folders are only listed at the library root, never inside an opened folder.
  const showFolderGrid = activeFolderId == null && fileFilter === "all" && filteredFolders.length > 0;

  const showIntroEmpty =
    !loading && activeFolderId == null && assets.length === 0 && folders.length === 0 && !q.trim() && fileFilter === "all";
  const showFilterEmpty =
    !showIntroEmpty && !loading && filteredFiles.length === 0 && (assets.length > 0 || q.trim().length > 0 || fileFilter !== "all" || activeFolderId != null);

  async function ensureUploadFolder(): Promise<string> {
    if (activeFolderId) return activeFolderId;
    if (folders[0]?.id) return folders[0].id;
    const created = await vendorMediaApi.createFolder("Library");
    setFolders((prev) => [created, ...prev]);
    return created.id;
  }

  async function uploadFiles(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.size > 0);
    if (!arr.length) return;
    setUploading(true);
    setErr("");
    try {
      const folderId = await ensureUploadFolder();
      const created: VendorMediaAsset[] = [];
      for (const file of arr) {
        const row = await vendorMediaApi.uploadToFolder(folderId, file);
        created.push(row);
      }
      setAssets((prev) => [...created, ...prev]);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function moveFile(assetId: string, folderId: string) {
    setErr("");
    try {
      const row = await vendorMediaApi.moveAsset(assetId, folderId);
      setAssets((prev) => prev.map((x) => (x.id === assetId ? row : x)));
      setMoveAssetId(null);
      setMoveFolderId("");
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Move failed");
    }
  }

  async function removeFile(id: string) {
    setErr("");
    try {
      await vendorMediaApi.deleteAsset(id);
      setAssets((prev) => prev.filter((x) => x.id !== id));
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Delete failed");
    }
  }

  async function createFolder() {
    const name = folderName.trim();
    if (!name) return;
    setErr("");
    try {
      const row = await vendorMediaApi.createFolder(name);
      setFolders((prev) => [row, ...prev]);
      setFolderName("");
      setFolderModal(false);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Create folder failed");
    }
  }

  async function removeFolder(folder: VendorMediaFolder) {
    const count = folderFileCount(folder.id);
    const warn = count
      ? `Delete folder "${folder.name}" and its ${count} file(s)? This cannot be undone.`
      : `Delete folder "${folder.name}"?`;
    if (typeof window !== "undefined" && !window.confirm(warn)) return;
    setErr("");
    try {
      await vendorMediaApi.deleteFolder(folder.id);
      setFolders((prev) => prev.filter((x) => x.id !== folder.id));
      setAssets((prev) => prev.filter((a) => a.folderId !== folder.id));
      if (activeFolderId === folder.id) setActiveFolderId(null);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Delete folder failed");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        {activeFolder ? (
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 font-semibold text-foreground hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              All files
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Folder className="h-4 w-4 text-primary" aria-hidden />
              {activeFolder.name}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Organize images and documents for listings. Files are stored on the server and available across devices.
          </p>
        )}
      </div>

      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {err}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files…"
              className="w-full rounded-xl border border-border bg-card py-3 pl-11 pr-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative">
              <select
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value as FileFilter)}
                className="appearance-none rounded-xl border border-border bg-card py-3 pl-4 pr-10 text-sm font-semibold text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                aria-label="Filter files"
              >
                <option value="all">All Files</option>
                <option value="images">Images</option>
                <option value="documents">Documents</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">▾</span>
            </div>
            <button
              type="button"
              onClick={() => setFolderModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-muted"
            >
              <FolderPlus className="h-4 w-4 text-muted-foreground" aria-hidden />
              + New Folder
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" aria-hidden />
              {uploading ? "Uploading…" : activeFolder ? `Upload to ${activeFolder.name}` : "Upload"}
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,application/pdf"
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget === e.target) setDragOver(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className={`mt-5 flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/50/50"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm ring-1 ring-border">
            <Upload className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium text-muted-foreground sm:text-base">
            Drag &amp; drop files here or use the upload button
          </p>
        </div>

        <div className="mt-8">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading media library…</p>
          ) : null}

          {!loading && showFolderGrid ? (
            <ul className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFolders.map((f) => (
                <li key={f.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(f.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-muted/50/80 px-4 py-3 pr-16 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Folder className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      <span className="truncate font-semibold text-foreground">{f.name}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                      {folderFileCount(f.id)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void removeFolder(f); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete folder ${f.name}`}
                    title="Delete folder"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!loading && filteredFiles.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredFiles.map((f) => (
                <li key={f.id} className="group overflow-hidden rounded-xl border border-border bg-card">
                  <div className="relative aspect-[4/3] bg-muted">
                    {isImageMime(f.mimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveMediaUrl(f.url) || f.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
                        <FileTextGlyph />
                        <span className="line-clamp-2 px-2 text-xs font-medium text-muted-foreground">{f.originalName}</span>
                      </div>
                    )}
                    <a
                      href={resolveMediaUrl(f.url) || f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10"
                      aria-label={`Open ${f.originalName}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMoveAssetId(f.id);
                        setMoveFolderId(folders.find((x) => x.id !== f.folderId)?.id || "");
                      }}
                      className="absolute left-2 top-2 rounded-lg bg-card/95 p-2 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border transition hover:text-primary group-hover:opacity-100"
                      aria-label={`Move ${f.originalName}`}
                    >
                      <FolderInput className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeFile(f.id)}
                      className="absolute right-2 top-2 rounded-lg bg-card/95 p-2 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border transition hover:text-destructive group-hover:opacity-100"
                      aria-label={`Delete ${f.originalName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="border-t border-border px-3 py-2">
                    <p className="truncate text-sm font-semibold text-foreground">{f.originalName}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(assetSize(f))}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : showIntroEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-muted p-6 text-muted-foreground/40">
                <ImageIcon className="h-14 w-14" aria-hidden />
              </div>
              <p className="mt-4 text-base font-medium text-muted-foreground">No files yet. Upload your first file!</p>
            </div>
          ) : showFilterEmpty ? (
            <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" aria-hidden />
              <p className="mt-3 text-sm font-medium">No files match your search or filter.</p>
            </div>
          ) : null}
        </div>
      </div>

      {moveAssetId ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setMoveAssetId(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="move-title" className="text-lg font-bold text-foreground">
              Move to folder
            </h2>
            <select
              className="mt-4 w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              value={moveFolderId}
              onChange={(e) => setMoveFolderId(e.target.value)}
            >
              <option value="">Select folder…</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveAssetId(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!moveFolderId}
                onClick={() => moveAssetId && moveFolderId && void moveFile(moveAssetId, moveFolderId)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {folderModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setFolderModal(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="folder-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="folder-title" className="text-lg font-bold text-foreground">
              New folder
            </h2>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-foreground">Name</span>
              <input
                className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Product photos"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createFolder();
                }}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolderModal(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createFolder()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FileTextGlyph() {
  return (
    <svg className="h-10 w-10 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
      />
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}
