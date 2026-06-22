"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Shield, Upload, X } from "lucide-react";
import { getVendorMe, patchVendorProfile, type VendorProfile } from "@/lib/api/vendor";
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

  async function saveDocumentUrl() {
    if (!me || !modalKind || readOnly) return;
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setBanner("Please paste a document link.");
      return;
    }
    if (!isHttpsUrl(trimmed)) {
      setBanner("Use an HTTPS link (e.g. a Google Drive “anyone with the link” URL).");
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
      <div className="flex min-w-0 items-center justify-center gap-2 py-20 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading KYC…
      </div>
    );
  }

  const kycOverall = String(me.kycStatus || "").toLowerCase();

  return (
    <div className="min-w-0 space-y-6">
      {readOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your application is still with admin. Document references from your signup appear below. To change them,{" "}
          <Link href="/onboarding" className="font-semibold text-[#0f766e] underline">
            edit your application
          </Link>
          .
        </div>
      ) : null}

      {kycOverall === "rejected" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Some documents were rejected. Update the links below and resubmit so admin can review again.
        </div>
      ) : null}

      {banner ? <p className="text-sm text-red-600">{banner}</p> : null}

      <div className="rounded-[14px] border border-[#20a090]/25 bg-[#20a090]/10 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#20a090] shadow-sm ring-1 ring-[#20a090]/20">
            <Shield className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-900">Vendor Identity Verification</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
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
              className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#20a090]/12 text-[#20a090]">
                    <FileText className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {meta.title}
                      {meta.optional ? (
                        <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Optional
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Upload className="h-4 w-4 text-slate-400" aria-hidden />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      submitted
                        ? "bg-[#20a090]/12 text-[#0f766e] ring-1 ring-[#20a090]/25"
                        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
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
                    className="font-semibold text-[#0f766e] underline hover:text-[#115e59]"
                  >
                    View document
                  </a>
                </p>
              ) : submitted ? (
                <p className="mt-3 text-xs text-slate-500">Reference on file. Add an HTTPS link to enable “View document”.</p>
              ) : null}
              <button
                type="button"
                disabled={readOnly}
                onClick={() => openModal(kind)}
                className="mt-4 flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="kyc-modal-title" className="text-lg font-bold text-slate-900">
                {KYC_DOC_META[modalKind].title}
              </h2>
              <button
                type="button"
                onClick={() => setModalKind(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Paste a secure <strong className="font-semibold text-slate-800">HTTPS</strong> link to your scan (PDF or
              image). Example: Google Drive shared link set to “Anyone with the link”.
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-800">Document URL</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25"
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
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDocumentUrl()}
                className="rounded-xl bg-[#20a090] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#188a7c] disabled:opacity-60"
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
