"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Store } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { clearAuthSession } from "@/lib/authSession";
import { signOutVendorFirebase } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AuthPageBackground,
  FormField,
  ReviewRow,
  WizardStepBar,
} from "@/components/auth/auth-ui";

const STEPS = ["Details", "KYC & Documents", "Bank", "Review"] as const;

type VendorKindChoice = "SERVICE" | "PRODUCT" | "BOTH";

function validatePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "Mobile number is required.";
  if (d.length !== 10) return "Enter a valid 10-digit mobile number.";
  if (!/^[6-9]/.test(d)) return "Number must start with 6, 7, 8 or 9.";
  return "";
}

function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(-10);
  return `+91-${d.slice(0, 3)}***${d.slice(-3)}`;
}

/**
 * Vendor self-registration form (NO OTP).
 *
 * The vendor fills the wizard end-to-end and submits. We record a pending
 * registration request for admin review — no phone verification, no account is
 * created here. After an admin approves, the vendor signs in via mobile OTP.
 *
 * Field set is intentionally aligned with `p4u-admin-web/.../VendorFormLayer.jsx`
 * so the captured data maps cleanly into a catalog vendor row on approval.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const [vendorKind, setVendorKind] = useState<VendorKindChoice>("PRODUCT");

  const [details, setDetails] = useState({
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
  });

  const [kyc, setKyc] = useState<{ gstCertName: string; panCardName: string }>({
    gstCertName: "",
    panCardName: "",
  });

  const [bank, setBank] = useState({
    bankName: "",
    ifscCode: "",
    accountHolderName: "",
    accountNumber: "",
  });

  // Keep registration on a clean session, so vendor self-signup is never
  // confused with a stale customer/admin token from another tab.
  useEffect(() => {
    clearAuthSession();
    void signOutVendorFirebase();
  }, []);

  // Pre-fill phone if the user came here from the login screen after their
  // phone was found to have no vendor account.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stashed = sessionStorage.getItem("p4u_vendor_register_phone");
    if (stashed) {
      const last10 = stashed.replace(/\D/g, "").slice(-10);
      setDetails((p) => (p.phone ? p : { ...p, phone: last10 }));
      sessionStorage.removeItem("p4u_vendor_register_phone");
    }
  }, []);

  function next() {
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  function buildPayload() {
    const wantsProduct = vendorKind === "PRODUCT" || vendorKind === "BOTH";
    const wantsService = vendorKind === "SERVICE" || vendorKind === "BOTH";
    return {
      vendorKind: (vendorKind === "SERVICE" ? "service" : vendorKind === "BOTH" ? "both" : "product") as
        | "service"
        | "product"
        | "both",
      vendorType: vendorKind,
      ownerName: details.ownerName.trim(),
      businessName: details.businessName.trim(),
      email: details.email.trim() || null,
      phone: details.phone.trim(),
      categoriesJson:
        wantsProduct && details.categorySlug.trim()
          ? [details.categorySlug.trim()]
          : null,
      servicesJson:
        wantsService && details.serviceName.trim()
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
    };
  }

  async function submitRegistration() {
    setError("");
    if (!details.ownerName.trim() || !details.businessName.trim()) {
      setError("Owner name and business name are required.");
      setStep(0);
      return;
    }
    const phoneErr = validatePhone(details.phone);
    if (phoneErr) {
      setError(phoneErr);
      setStep(0);
      return;
    }
    setLoading(true);
    try {
      await authApi.registerVendor(buildPayload());
      setRegistrationSuccess(true);
      setTimeout(() => {
        router.replace("/login?registered=1");
      }, 4000);
    } catch (err: unknown) {
      setError(
        (err as { message?: string })?.message ||
          "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageBackground>
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-8">
        <header className="mb-8 flex items-center gap-3">
          <Link href="/" className="rounded-xl p-2 hover:bg-card/80">
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Vendor Registration</h1>
            <p className="text-sm text-muted-foreground">
              {vendorKind === "SERVICE" ? "Service vendor" : vendorKind === "BOTH" ? "Product & Service vendor" : "Product vendor"}
            </p>
          </div>
        </header>

        <WizardStepBar step={step} onStepClick={(i) => i <= step && setStep(i)} />

        {registrationSuccess ? (
          <Card className="border-success/30 bg-success/5 p-8 text-center shadow-elevated">
            <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-success" />
            <h2 className="text-xl font-bold text-foreground">Registration submitted</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Your registration request has been submitted successfully. It will be reviewed and
              approved within 24 hours.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
              Once approved, sign in from the vendor login screen using your mobile OTP.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">Redirecting to the login screen…</p>
          </Card>
        ) : (
        <Card className="border-border/50 p-6 shadow-elevated sm:p-8">
          {step === 0 && (
            <section className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Details</h2>
              <p className="text-sm text-muted-foreground">
                Sign-in is via mobile OTP — no username or password to remember. After your
                application is approved you will sign in with this mobile number.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Owner Name *">
                  <Input
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
                <FormField label="Mobile (10 digits) *">
                  <input
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={details.phone}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                  />
                </FormField>
                <FormField label="Vendor Type *">
                  <select
                    className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                    value={vendorKind}
                    onChange={(e) => setVendorKind(e.target.value as VendorKindChoice)}
                  >
                    <option value="PRODUCT">Product Vendor</option>
                    <option value="SERVICE">Service Vendor</option>
                    <option value="BOTH">Both</option>
                  </select>
                </FormField>
                {(vendorKind === "PRODUCT" || vendorKind === "BOTH") ? (
                  <FormField label="Vendor Category">
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      placeholder="e.g. groceries, electronics"
                      value={details.categorySlug}
                      onChange={(e) =>
                        setDetails({ ...details, categorySlug: e.target.value })
                      }
                    />
                  </FormField>
                ) : null}
                {(vendorKind === "SERVICE" || vendorKind === "BOTH") ? (
                  <FormField label="Services">
                    <input
                      className="input flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2 text-sm"
                      placeholder="e.g. salon, plumbing"
                      value={details.serviceName}
                      onChange={(e) =>
                        setDetails({ ...details, serviceName: e.target.value })
                      }
                    />
                  </FormField>
                ) : null}
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
                        setDetails({
                          ...details,
                          registeredShopAddress: e.target.value,
                        })
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
                Upload your GST Certificate and PAN Card. Files will be stored against your vendor
                application for admin verification.
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
                    onChange={(e) => setBank({ ...bank, accountHolderName: e.target.value })}
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
              <ReviewRow label="Mobile" value={details.phone ? maskPhone(details.phone) : ""} />
              {vendorKind === "BOTH" ? (
                <>
                  <ReviewRow label="Vendor category" value={details.categorySlug} />
                  <ReviewRow label="Services" value={details.serviceName} />
                </>
              ) : (
                <ReviewRow
                  label={vendorKind === "SERVICE" ? "Services" : "Vendor category"}
                  value={vendorKind === "SERVICE" ? details.serviceName : details.categorySlug}
                />
              )}
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
                Submitting will queue your application for admin approval. You will not be able to
                sign in until an admin approves your registration — we&apos;ll review it within 24 hours.
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
              <Button type="button" onClick={() => void submitRegistration()} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  "Submit Registration"
                )}
              </Button>
            )}
          </div>
        </Card>
        )}
      </div>
    </AuthPageBackground>
  );
}
