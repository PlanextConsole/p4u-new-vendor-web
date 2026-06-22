"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, ImageIcon, Search, Trash2, Upload } from "lucide-react";

type FileFilter = "all" | "images" | "documents";

type MediaFolder = { id: string; name: string; createdAt: number };

type MediaFileItem = {
  id: string;
  name: string;
  mime: string;
  size: number;
  objectUrl: string;
  createdAt: number;
};

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

export default function VendorMediaLibraryView() {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [files, setFiles] = useState<MediaFileItem[]>([]);
  const [q, setQ] = useState("");
  const [fileFilter, setFileFilter] = useState<FileFilter>("all");
  const [dragOver, setDragOver] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<MediaFileItem[]>([]);
  filesRef.current = files;

  const revokeAll = useCallback((list: MediaFileItem[]) => {
    for (const f of list) {
      try {
        URL.revokeObjectURL(f.objectUrl);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    return () => revokeAll(filesRef.current);
  }, [revokeAll]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list);
    const next: MediaFileItem[] = [];
    for (const file of arr) {
      if (!file.size) continue;
      const objectUrl = URL.createObjectURL(file);
      next.push({
        id: newId(),
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        objectUrl,
        createdAt: Date.now(),
      });
    }
    if (next.length) setFiles((prev) => [...next, ...prev]);
  }, []);

  const filteredFiles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return files.filter((f) => acceptFilter(fileFilter, f.mime) && (!t || f.name.toLowerCase().includes(t)));
  }, [files, q, fileFilter]);

  const filteredFolders = useMemo(() => {
    const t = q.trim().toLowerCase();
    return folders.filter((f) => !t || f.name.toLowerCase().includes(t));
  }, [folders, q]);

  const showIntroEmpty = files.length === 0 && folders.length === 0 && !q.trim() && fileFilter === "all";
  /** Search/filter yielded no files, but the library is not the pristine empty state (e.g. filter hides all images). */
  const showFilterEmpty =
    !showIntroEmpty &&
    filteredFiles.length === 0 &&
    (files.length > 0 || q.trim().length > 0 || fileFilter !== "all");

  function removeFile(id: string) {
    setFiles((prev) => {
      const row = prev.find((x) => x.id === id);
      if (row) {
        try {
          URL.revokeObjectURL(row.objectUrl);
        } catch {
          /* ignore */
        }
      }
      return prev.filter((x) => x.id !== id);
    });
  }

  function removeFolder(id: string) {
    setFolders((prev) => prev.filter((x) => x.id !== id));
  }

  function createFolder() {
    const name = folderName.trim();
    if (!name) return;
    setFolders((prev) => [{ id: newId(), name, createdAt: Date.now() }, ...prev]);
    setFolderName("");
    setFolderModal(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          Organize images and documents for listings. Files stay in this browser until server upload is enabled.
        </p>
      </div>

      <div className="rounded-[14px] border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files…"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#20a090]/50 focus:ring-2 focus:ring-[#20a090]/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative">
              <select
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value as FileFilter)}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-800 outline-none focus:border-[#20a090]/50 focus:ring-2 focus:ring-[#20a090]/20"
                aria-label="Filter files"
              >
                <option value="all">All Files</option>
                <option value="images">Images</option>
                <option value="documents">Documents</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">▾</span>
            </div>
            <button
              type="button"
              onClick={() => setFolderModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <FolderPlus className="h-4 w-4 text-slate-600" aria-hidden />
              + New Folder
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#20a090] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#188a7c]"
            >
              <Upload className="h-4 w-4" aria-hidden />
              Upload
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.csv,application/pdf"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* Drop zone */}
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
            dragOver ? "border-[#20a090] bg-[#20a090]/5" : "border-slate-200 bg-slate-50/50"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
            <Upload className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600 sm:text-base">
            Drag &amp; drop files here or use the upload button
          </p>
        </div>

        {/* Folders + files */}
        <div className="mt-8">
          {filteredFolders.length > 0 && fileFilter === "all" ? (
            <ul className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredFolders.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FolderPlus className="h-5 w-5 shrink-0 text-[#20a090]" aria-hidden />
                    <span className="truncate font-semibold text-slate-800">{f.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFolder(f.id)}
                    className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600"
                    aria-label={`Remove folder ${f.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {filteredFolders.length > 0 && fileFilter === "all" && files.length === 0 ? (
            <p className="mb-6 text-center text-sm text-slate-500">Upload files to fill this library. Folders help you plan organization.</p>
          ) : null}

          {filteredFiles.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredFiles.map((f) => (
                <li
                  key={f.id}
                  className="group overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {isImageMime(f.mime) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- blob URLs
                      <img src={f.objectUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center">
                        <FileTextGlyph />
                        <span className="line-clamp-2 px-2 text-xs font-medium text-slate-600">{f.name}</span>
                      </div>
                    )}
                    <a
                      href={f.objectUrl}
                      download={f.name}
                      className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10"
                      aria-label={`Download ${f.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      className="absolute right-2 top-2 rounded-lg bg-white/95 p-2 text-slate-500 opacity-0 shadow-sm ring-1 ring-slate-200 transition hover:text-red-600 group-hover:opacity-100"
                      aria-label={`Delete ${f.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="border-t border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{f.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(f.size)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : showIntroEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-slate-100 p-6 text-slate-300">
                <ImageIcon className="h-14 w-14" aria-hidden />
              </div>
              <p className="mt-4 text-base font-medium text-slate-500">No files yet. Upload your first file!</p>
            </div>
          ) : showFilterEmpty ? (
            <div className="flex flex-col items-center justify-center py-14 text-center text-slate-500">
              <ImageIcon className="h-10 w-10 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm font-medium">No files match your search or filter.</p>
            </div>
          ) : null}
        </div>
      </div>

      {folderModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setFolderModal(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="folder-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="folder-title" className="text-lg font-bold text-slate-900">
              New folder
            </h2>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-800">Name</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Product photos"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") createFolder();
                }}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFolderModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createFolder()}
                className="rounded-xl bg-[#20a090] px-4 py-2 text-sm font-semibold text-white hover:bg-[#188a7c]"
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
    <svg className="h-10 w-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
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
