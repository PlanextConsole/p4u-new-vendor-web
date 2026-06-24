"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, LogOut, Store } from "lucide-react";
import {
  getMyVendorOnboarding,
  submitMyVendorOnboarding,
  type VendorOnboardingPayload,
} from "@/lib/api/onboarding";
import { getStoredUsername, hasVendorSession, signOutVendorCompletely } from "@/lib/authSession";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AuthPageBackground,
  FormField,
  ReviewRow,
  WizardStepBar,
} from "@/components/auth/auth-ui";

const STEPS = ["Details", "KYC & Documents", "Bank", "Review"] as const;

type VendorKindChoice = "SERVICE" | "PRODUCT";

interface DetailsState {
  ownerName: string;
  businessName: string;
  email: string;
  phone: string;
  categorySlug: string;
  serviceName: string;
  gst: string;
  pan: string;
  stateName: string;
  stateCode: string;
  registeredShopAddress: string;
}

interface KycState {
  gstCertName: string;
  panCardName: string;
}

interface BankState {
  bankName: string;
  ifscCode: string;
  accountHolderName: string;
  accountNumber: string;
}

const emptyDetails: DetailsState = {
  ownerName: "",
  businessName: "",
  email: "",
  phone: "",
  categorySlug: "",
  serviceName: "",
  gst: "",
  pan: "",
  stateName: "",
  stateCode: "",
  registeredShopAddress: "",
};

/**
 * Vendor onboarding wizard.
 *
 * Lives at top-level `/onboarding` — deliberately NOT under `/dashboard/`
 * so it is not wrapped by VendorPortalShell. The shell requires a vendor
 * profile, which is exactly what this page is responsible for collecting,
 * so nesting it inside the shell would cause a redirect loop.
 *
 * Reached after a real login when the authenticated user has a VENDOR role
 * but no catalog vendor row yet. Field set is the same one admin collects
 * (see admin VendorFormLayer.jsx). On submit, posts to the auth-management
 * vendor onboarding endpoint which writes a vendor_signup_requests row.
 */
export default function VendorOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrap, setBootstrap] = useState(true);

  const [vendorKind, setVendorKind] = useState<VendorKindChoice>("SERVICE");
  const [details, setDetails] = useState<DetailsState>(emptyDetails);
  const [kyc, setKyc] = useState<KycState>({ gstCertName: "", panCardName: "" });
  const [bank, setBank] = useState<BankState>({
    bankName: "",
    ifscCode: "",
    accountHolderName: "",
    accountNumber: "",
  });

  // Send anyone without a token back to login. Pre-fill fields from any
  // existing pending onboarding row so a vendor can pick up where they left
  // off (instead of restarting from blank on every visit).
  useEffect(() => {
    if (!hasVendorSession()) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rec = await getMyVendorOnboarding();
        if (cancelled) return;
        const p = rec.payload as Record<string, unknown>;
        const vt =
          String(p.vendorType || p.vendorKind || "").toUpperCase() === "PRODUCT"
            ? "PRODUCT"
            : "SERVICE";
        setVendorKind(vt);
        setDetails({
          ownerName: pickString(p.ownerName),
          businessName: pickString(p.businessName),
          email: pickString(p.email),
          phone: pickString(p.phone),
          categorySlug: pickStringFromArray(p.categoriesJson),
          serviceName: pickStringFromArray(p.servicesJson),
          gst: pickString(p.gst),
          pan: pickString(p.pan),
          stateName: pickStringNested(p.addressJson, "state"),
          stateCode: pickStringNested(p.addressJson, "stateCode"),
          registeredShopAddress: pickStringNested(p.addressJson, "areaLocality"),
        });
        const docs = (p.documentsJson || {}) as Record<string, unknown>;
        setKyc({
          gstCertName: pickString(docs.gstCertificateFileName),
          panCardName: pickString(docs.panCardFileName),
        });
        const bnk = (p.bankJson || {}) as Record<string, unknown>;
        setBank({
          bankName: pickString(bnk.bankName),
          ifscCode: pickString(bnk.ifscCode),
          accountHolderName: pickString(bnk.accountHolderName),
          accountNumber: pickString(bnk.accountNumber),
        });
      } catch {
        // No prior request — start blank, that's fine.
      } finally {
        if (!cancelled) setBootstrap(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function next() {
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const body: VendorOnboardingPayload = {
        vendorType: vendorKind,
        vendorKind: vendorKind === "SERVICE" ? "service" : "product",
        ownerName: details.ownerName.trim(),
        businessName: details.businessName.trim(),
        email: details.email.trim() || null,
        phone: details.phone.trim() || null,
        categoriesJson:
          vendorKind === "PRODUCT" && details.categorySlug.trim()
            ? [details.categorySlug.trim()]
            : null,
        servicesJson:
          vendorKind === "SERVICE" && details.serviceName.trim()
            ? [details.serviceName.trim()]
            : null,
        gst: details.gst.trim() || null,
        pan: details.pan.trim() || null,
        addressJson: {
          state: details.stateName.trim() || null,
          stateCode: details.stateCode.trim() || null,
          areaLocality: details.registeredShopAddress.trim() || null,
        },
        documentsJson: {
          gstCertificateFileName: kyc.gstCertName || null,
          panCardFileName: kyc.panCardName || null,
        },
        bankJson: {
          bankName: bank.bankName.trim() || null,
          ifscCode: bank.ifscCode.trim() || null,
          accountHolderName: bank.accountHolderName.trim() || null,
          accountNumber: bank.accountNumber.trim() || null,
        },
        source: "p4u-new-vendor-web/onboarding",
      };

      await submitMyVendorOnboarding(body);
      router.replace(
        vendorKind === "SERVICE" ? "/dashboard/service" : "/dashboard/product",
      );
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Submission failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await signOutVendorCompletely();
    router.replace("/");
  }

  if (bootstrap) {
    return (
      <AuthPageBackground>
        <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Loading your application…</p>
        </div>
      </AuthPageBackground>
    );
  }

  const username = getStoredUsername();

  return (
    <AuthPageBackground>
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-8">
        <header className="mb-8 flex items-center gap-3">
          <Link href="/" className="rounded-xl p-2 hover:bg-card/80" aria-label="Back to login">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground">Complete your vendor profile</h1>
            <p className="truncate text-sm text-muted-foreground">
              {username ? `Signed in as ${username} · ` : ""}fill your business details to access the dashboard
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void logout()} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </header>

        <WizardStepBar step={step} onStepClick={(i) => i <= step && setStep(i)} />

        <Card className="border-border/50 p-6 shadow-elevated sm:p-8">
          {step === 0 && (
            <section className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Owner Name *">
                  <input
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={details.ownerName}
                    onChange={(e) => setDetails({ ...details, ownerName: e.target.value })}
                  />
                </FormField>
                <FormField label="Business Name *">
                  <input
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={details.businessName}
                    onChange={(e) => setDetails({ ...details, businessName: e.target.value })}
                  />
                </FormField>
                <FormField label="Email">
                  <input
                    type="email"
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={details.email}
                    onChange={(e) => setDetails({ ...details, email: e.target.value })}
                  />
                </FormField>
                <FormField label="Mobile">
                  <input
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                  />
                </FormField>
                <FormField label="Vendor Type *">
                  <select
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={vendorKind}
                    onChange={(e) => setVendorKind(e.target.value as VendorKindChoice)}
                  >
                    <option value="SERVICE">Service Vendor</option>
                    <option value="PRODUCT">Product Vendor</option>
                  </select>
                </FormField>
                {vendorKind === "PRODUCT" ? (
                  <FormField label="Vendor Category">
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      placeholder="e.g. groceries, electronics"
                      value={details.categorySlug}
                      onChange={(e) => setDetails({ ...details, categorySlug: e.target.value })}
                    />
                  </FormField>
                ) : (
                  <FormField label="Services">
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      placeholder="e.g. salon, plumbing"
                      value={details.serviceName}
                      onChange={(e) => setDetails({ ...details, serviceName: e.target.value })}
                    />
                  </FormField>
                )}
              </div>

              <div className="rounded-xl bg-vendor-teal-muted/40 p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-vendor-teal-dark">GST &amp; TAX COMPLIANCE</h3>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                    Required for tax invoices
                  </span>
                </div>
                <p className="mb-3 text-xs text-slate-600">
                  These details appear on customer tax invoice issued under vendor name.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="GSTIN (15 chars)">
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      maxLength={15}
                      value={details.gst}
                      onChange={(e) => setDetails({ ...details, gst: e.target.value })}
                    />
                  </FormField>
                  <FormField label="PAN (10 chars)">
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      maxLength={10}
                      value={details.pan}
                      onChange={(e) => setDetails({ ...details, pan: e.target.value })}
                    />
                  </FormField>
                  <FormField label="State Name (place of supply)">
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      value={details.stateName}
                      onChange={(e) => setDetails({ ...details, stateName: e.target.value })}
                    />
                  </FormField>
                  <FormField label="State Code (2 digits)">
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      maxLength={2}
                      value={details.stateCode}
                      onChange={(e) => setDetails({ ...details, stateCode: e.target.value })}
                    />
                  </FormField>
                  <FormField
                    label="Registered Shop Address (printed on invoice)"
                    className="sm:col-span-2"
                  >
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      value={details.registeredShopAddress}
                      onChange={(e) =>
                        setDetails({ ...details, registeredShopAddress: e.target.value })
                      }
                    />
                  </FormField>
                </div>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">KYC &amp; Documents</h2>
              <p className="text-sm text-slate-600">
                Attach your GST Certificate and PAN card. Files are kept against your application
                for admin verification.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="GST Certificate">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    onChange={(e) =>
                      setKyc((p) => ({
                        ...p,
                        gstCertName: e.target.files?.[0]?.name ?? "",
                      }))
                    }
                  />
                  {kyc.gstCertName ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      Selected: {kyc.gstCertName}
                    </span>
                  ) : null}
                </FormField>
                <FormField label="PAN Card">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    onChange={(e) =>
                      setKyc((p) => ({
                        ...p,
                        panCardName: e.target.files?.[0]?.name ?? "",
                      }))
                    }
                  />
                  {kyc.panCardName ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      Selected: {kyc.panCardName}
                    </span>
                  ) : null}
                </FormField>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">Bank</h2>
              <p className="text-sm text-slate-600">
                Bank account where vendor settlements will be paid out.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Bank Name">
                  <input
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={bank.bankName}
                    onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
                  />
                </FormField>
                <FormField label="IFSC">
                  <input
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={bank.ifscCode}
                    onChange={(e) => setBank({ ...bank, ifscCode: e.target.value })}
                  />
                </FormField>
                <FormField label="Account Holder">
                  <input
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={bank.accountHolderName}
                    onChange={(e) =>
                      setBank({ ...bank, accountHolderName: e.target.value })
                    }
                  />
                </FormField>
                <FormField label="Account Number">
                  <input
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={bank.accountNumber}
                    onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
                  />
                </FormField>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-3 text-sm text-slate-700">
              <h2 className="text-lg font-semibold text-slate-900">Review</h2>
              <ReviewRow label="Vendor type" value={vendorKind} />
              <ReviewRow label="Owner name" value={details.ownerName} />
              <ReviewRow label="Business name" value={details.businessName} />
              <ReviewRow label="Email" value={details.email} />
              <ReviewRow label="Mobile" value={details.phone} />
              <ReviewRow
                label={vendorKind === "SERVICE" ? "Services" : "Vendor category"}
                value={vendorKind === "SERVICE" ? details.serviceName : details.categorySlug}
              />
              <ReviewRow label="GSTIN" value={details.gst} />
              <ReviewRow label="PAN" value={details.pan} />
              <ReviewRow
                label="State"
                value={[details.stateName, details.stateCode].filter(Boolean).join(" / ")}
              />
              <ReviewRow label="Shop address" value={details.registeredShopAddress} />
              <ReviewRow label="GST certificate" value={kyc.gstCertName} />
              <ReviewRow label="PAN card" value={kyc.panCardName} />
              <ReviewRow label="Bank" value={bank.bankName} />
              <ReviewRow label="IFSC" value={bank.ifscCode} />
              <ReviewRow label="Account holder" value={bank.accountHolderName} />
              <ReviewRow label="Account number" value={bank.accountNumber} />
              <p className="pt-4 text-slate-600">
                Submitting unlocks your dashboard immediately. Admin will verify your documents
                in the background; you may keep using the portal in the meantime.
              </p>
            </section>
          )}

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

          <div className="mt-8 flex justify-between gap-4">
            <Button type="button" variant="outline" onClick={back} disabled={step === 0 || loading}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={loading} className="gap-2">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => void submit()} disabled={loading}>
                {loading ? "Submitting…" : "Submit & continue"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </AuthPageBackground>
  );
}

function pickString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function pickStringNested(v: unknown, key: string): string {
  if (!v || typeof v !== "object") return "";
  const inner = (v as Record<string, unknown>)[key];
  return typeof inner === "string" ? inner : "";
}

function pickStringFromArray(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return "";
  const first = v[0];
  return typeof first === "string" ? first : "";
}
