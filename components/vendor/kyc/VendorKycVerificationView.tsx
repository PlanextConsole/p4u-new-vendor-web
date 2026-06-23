"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Shield, Upload, X } from "lucide-react";
import { VendorFormLayout } from "@/components/vendor/VendorListUi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getVendorMe, patchVendorProfile, type VendorProfile } from "@/lib/api/vendor";
import { vendorUploadDocument } from "@/lib/api/vendorDocuments";
import { KYC_DOC_META, isKycDocSubmitted, kycDocViewUrl, type KycDocKind } from "@/lib/vendor/kycDocuments";

function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong.";
}

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function isAllowedDocUrl(s: string): boolean {
  const t = s.trim();
  if (t.startsWith("/vendor-uploads/")) return true;
  return isHttpsUrl(t);
}

export default function VendorKycVerificationView() {
  const [me, setMe] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalKind, setModalKind] = useState<KycDocKind | null>(null);
  const [urlDraft, setUrlDraft] = useState("");

  const readOnly = me?.source === "onboarding";

  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const profile = await getVendorMe();
      setMe(profile);
    } catch (e: unknown) {
      setBanner(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const docs =
    me?.documentsJson && typeof me.documentsJson === "object" && !Array.isArray(me.documentsJson)
      ? (me.documentsJson as Record<string, unknown>)
      : {};

  function openModal(kind: KycDocKind) {
    setUrlDraft(kycDocViewUrl(docs, kind));
    setModalKind(kind);
    setBanner("");
  }

  async function saveDocumentFromUpload(file: File) {
    if (!me || !modalKind || readOnly) return;
    const meta = KYC_DOC_META[modalKind];
    setSaving(true);
    setBanner("");
    try {
      const url = await vendorUploadDocument(file);
      const prev =
        me.documentsJson && typeof me.documentsJson === "object" && !Array.isArray(me.documentsJson)
          ? { ...me.documentsJson }
          : {};
      prev[meta.urlKey] = url;
      prev[meta.fileNameKey] = file.name;
      const updated = await patchVendorProfile({ documentsJson: prev });
      setMe({ ...updated, source: "catalog" });
      setModalKind(null);
      setUrlDraft("");
    } catch (e: unknown) {
      setBanner(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveDocumentUrl() {
    if (!me || !modalKind || readOnly) return;
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setBanner("Please paste a document link.");
      return;
    }
    if (!isAllowedDocUrl(trimmed)) {
      setBanner("Use an HTTPS link or upload a file below.");
      return;
    }
    const meta = KYC_DOC_META[modalKind];
    setSaving(true);
    setBanner("");
    try {
      const prev =
        me.documentsJson && typeof me.documentsJson === "object" && !Array.isArray(me.documentsJson)
          ? { ...me.documentsJson }
          : {};
      prev[meta.urlKey] = trimmed;
      const updated = await patchVendorProfile({ documentsJson: prev });
      setMe({ ...updated, source: "catalog" });
      setModalKind(null);
      setUrlDraft("");
    } catch (e: unknown) {
      setBanner(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !me) {
    return (
      <div className="min-w-0 space-y-4 py-6">
        <Skeleton className="h-24 rounded-2xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  const kycOverall = String(me.kycStatus || "").toLowerCase();

  return (
    <VendorFormLayout width="md">
      {readOnly ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Your application is still with admin. Document references from your signup appear below. To change them,{" "}
          <Link href="/onboarding" className="font-semibold text-primary underline">
            edit your application
          </Link>
          .
        </div>
      ) : null}

      {kycOverall === "rejected" ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Some documents were rejected. Update the links below and resubmit so admin can review again.
        </div>
      ) : null}

      {banner ? <p className="text-sm text-destructive">{banner}</p> : null}

      <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-primary/20">
            <Shield className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground">Vendor Identity Verification</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Submit Aadhaar, PAN, and (optionally) GST. Admin will verify within 24–48 hours. Rejected documents can be
              resubmitted.
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-4">
        {(["aadhaar", "pan", "gst"] as const).map((kind) => {
          const meta = KYC_DOC_META[kind];
          const submitted = isKycDocSubmitted(docs, kind);
          const viewUrl = kycDocViewUrl(docs, kind);
          return (
            <li
              key={kind}
              className="rounded-2xl border border-border bg-card p-4  sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <FileText className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">
                      {meta.title}
                      {meta.optional ? (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Optional
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      submitted
                        ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                        : "bg-muted text-muted-foreground ring-1 ring-border/80"
                    }`}
                  >
                    {submitted ? "Submitted" : "Not Submitted"}
                  </span>
                </div>
              </div>
              {submitted && viewUrl ? (
                <p className="mt-3 text-sm">
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary underline hover:text-[#115e59]"
                  >
                    View document
                  </a>
                </p>
              ) : submitted ? (
                <p className="mt-3 text-xs text-muted-foreground">Reference on file. Add an HTTPS link to enable “View document”.</p>
              ) : null}
              <button
                type="button"
                disabled={readOnly}
                onClick={() => openModal(kind)}
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-border bg-card py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit Document
              </button>
            </li>
          );
        })}
      </ul>

      {modalKind ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 sm:p-6"
          onClick={() => setModalKind(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="kyc-modal-title" className="text-lg font-bold text-foreground">
                {KYC_DOC_META[modalKind].title}
              </h2>
              <button
                type="button"
                onClick={() => setModalKind(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-muted-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload a PDF or image, or paste a secure <strong className="font-semibold text-foreground">HTTPS</strong> link.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-foreground">Upload file</span>
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                className="mt-2 block w-full text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                disabled={saving}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void saveDocumentFromUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-foreground">Or document URL</span>
              <input
                className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://…"
                autoComplete="url"
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalKind(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDocumentUrl()}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </VendorFormLayout>
  );
}
