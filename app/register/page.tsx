"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { ArrowLeft, ArrowRight, Loader2, Store } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { clearAuthSession, persistAuthSession } from "@/lib/authSession";
import { clearRecaptcha, sendPhoneOtp, signOutVendorFirebase } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AuthPageBackground,
  FormField,
  OtpInputRow,
  ReviewRow,
  WizardStepBar,
} from "@/components/auth/auth-ui";

const STEPS = ["Details", "KYC & Documents", "Bank", "Review"] as const;

type VendorKindChoice = "SERVICE" | "PRODUCT";

const RECAPTCHA_ID = "p4u-vendor-register-recaptcha";
const OTP_LEN = 6;
const RESEND_S = 30;

function validatePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "Mobile number is required.";
  if (d.length !== 10) return "Enter a valid 10-digit mobile number.";
  if (!/^[6-9]/.test(d)) return "Number must start with 6, 7, 8 or 9.";
  return "";
}

function toE164(raw: string): string {
  return `+91${raw.replace(/\D/g, "").slice(-10)}`;
}

function maskPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(-10);
  return `+91-${d.slice(0, 3)}***${d.slice(-3)}`;
}

/**
 * Vendor self-registration form (OTP-LAST flow).
 *
 * Field set is intentionally aligned with `p4u-admin-web/.../VendorFormLayer.jsx`
 * (the form admin uses for both Product Vendor and Service Vendor) so that the
 * data captured here can be promoted into a catalog vendor row by ops with no
 * field translation. Admin-only fields (status, vendor plan, commission %,
 * enrollment cost, payment status, transaction ref) are deliberately omitted.
 *
 * Flow: vendor fills the wizard end-to-end → clicks Submit → an OTP modal
 * verifies the phone via Firebase Phone Auth → on success we ship the whole
 * payload + a fresh Firebase ID token to the backend, which creates the
 * Keycloak user + catalog_vendors row + audit row in one shot and returns
 * Keycloak tokens. The browser then lands directly inside the dashboard.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  // OTP modal state
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<"send" | "verify">("send");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [otpError, setOtpError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [timer, setTimer] = useState(RESEND_S);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sendLock = useRef(false);

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

  useEffect(() => {
    return () => {
      clearRecaptcha();
    };
  }, []);

  useEffect(() => {
    if (!otpOpen || otpStep !== "verify" || timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [otpOpen, otpStep, timer]);

  function next() {
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  function buildPayload(idToken: string) {
    return {
      firebaseIdToken: idToken,
      vendorKind: (vendorKind === "SERVICE" ? "service" : "product") as
        | "service"
        | "product",
      vendorType: vendorKind,
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
    };
  }

  async function openOtpAndSend() {
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
    clearRecaptcha();
    setOtpOpen(true);
    setOtpStep("send");
    setOtpError("");
    setOtpInfo("");
    await sendOtp();
  }

  async function sendOtp() {
    if (sendLock.current) return;
    sendLock.current = true;
    setOtpLoading(true);
    setOtpError("");
    try {
      const c = await sendPhoneOtp(toE164(details.phone), RECAPTCHA_ID);
      setConfirmation(c);
      setOtp(Array(OTP_LEN).fill(""));
      setTimer(RESEND_S);
      setOtpStep("verify");
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
    } catch (err: unknown) {
      const code = String((err as { code?: string })?.code || "");
      if (code.includes("too-many-requests")) {
        setOtpError("Too many OTP attempts. Please try again later.");
      } else if (code.includes("invalid-phone-number")) {
        setOtpError("Invalid phone number for OTP delivery.");
      } else if (code.includes("operation-not-allowed")) {
        setOtpError(
          "Phone sign-in is not enabled in Firebase. Ask the admin to enable it.",
        );
      } else if (code.includes("argument-error")) {
        setOtpError(
          "Phone verification could not start. Close this dialog and try “Verify phone & Submit” again, or tap Retry.",
        );
      } else {
        setOtpError(
          (err as { message?: string })?.message ||
            "Failed to send OTP. Please retry.",
        );
      }
      setOtpStep("send");
    } finally {
      sendLock.current = false;
      setOtpLoading(false);
    }
  }

  async function resend() {
    if (timer > 0 || otpLoading) return;
    setOtpInfo("");
    await sendOtp();
    setOtpInfo("OTP resent. Please check your messages.");
  }

  async function verifyAndSubmit() {
    if (!confirmation) {
      setOtpError("OTP session expired. Please request a new code.");
      return;
    }
    if (otp.some((d) => d === "")) {
      setOtpError("Please enter all 6 digits.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    setLoading(true);
    try {
      const cred = await confirmation.confirm(otp.join(""));
      const idToken = await cred.user.getIdToken();
      const payload = buildPayload(idToken);
      const auth = await authApi.registerVendorByPhone(payload);
      persistAuthSession(auth, toE164(details.phone));
      // Land in the type-specific dashboard. The portal shell will show a
      // "Profile pending verification" banner because catalog_vendors.status
      // is `pending` until admin approves.
      router.replace(
        vendorKind === "SERVICE" ? "/dashboard/service" : "/dashboard/product",
      );
    } catch (err: unknown) {
      const code = String((err as { code?: string })?.code || "");
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status?: number }).status)
          : NaN;
      if (code.includes("invalid-verification-code")) {
        setOtpError("Incorrect OTP. Please try again.");
      } else if (code.includes("code-expired")) {
        setOtpError("OTP expired. Please request a new one.");
      } else if (status === 401) {
        setOtpError(
          "Registration was rejected while calling the server (session conflict). Close this dialog, refresh the page, and submit again.",
        );
      } else {
        setOtpError(
          (err as { message?: string })?.message || "Submission failed.",
        );
      }
    } finally {
      setOtpLoading(false);
      setLoading(false);
    }
  }

  function closeOtp() {
    setOtpOpen(false);
    setOtpStep("send");
    setConfirmation(null);
    setOtp(Array(OTP_LEN).fill(""));
    setOtpError("");
    setOtpInfo("");
    clearRecaptcha();
  }

  function changeOtp(i: number, val: string) {
    const d = val.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    setOtpError("");
    if (d && i < OTP_LEN - 1) otpRefs.current[i + 1]?.focus();
  }

  function keyDownOtp(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (!otp[i] && i > 0) {
        setOtp((prev) => {
          const next = [...prev];
          next[i - 1] = "";
          return next;
        });
        otpRefs.current[i - 1]?.focus();
      } else {
        setOtp((prev) => {
          const next = [...prev];
          next[i] = "";
          return next;
        });
      }
    }
    if (e.key === "ArrowLeft" && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < OTP_LEN - 1) otpRefs.current[i + 1]?.focus();
    if (e.key === "Enter" && otp.every((d) => d !== "")) void verifyAndSubmit();
  }

  function pasteOtp(e: React.ClipboardEvent) {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LEN);
    if (!p) return;
    const next = Array(OTP_LEN).fill("");
    p.split("").forEach((d, idx) => {
      next[idx] = d;
    });
    setOtp(next);
    otpRefs.current[Math.min(p.length, OTP_LEN - 1)]?.focus();
  }

  const mm = String(Math.floor(timer / 60)).padStart(2, "0");
  const ss = String(timer % 60).padStart(2, "0");

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
              {vendorKind === "SERVICE" ? "Service vendor" : "Product vendor"}
            </p>
          </div>
        </header>

        <WizardStepBar step={step} onStepClick={(i) => i <= step && setStep(i)} />

        <Card className="border-border/50 p-6 shadow-elevated sm:p-8">
          {step === 0 && (
            <section className="space-y-5">
              <h2 className="text-lg font-semibold text-foreground">Details</h2>
              <p className="text-sm text-muted-foreground">
                Sign-in is via mobile OTP — no username or password to remember. We
                will verify your phone at the end of this form.
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
                  </select>
                </FormField>
                {vendorKind === "PRODUCT" ? (
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
                ) : (
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
                Submitting will verify your phone via OTP and create your vendor account.
                Your application will be queued for admin approval — you can keep using
                the dashboard while approval is pending.
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
              <Button type="button" onClick={() => void openOtpAndSend()} disabled={loading}>
                {loading ? "Submitting…" : "Verify phone & Submit"}
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div id={RECAPTCHA_ID} className="sr-only" aria-hidden="true" />

      <Dialog open={otpOpen} onOpenChange={(open) => !open && closeOtp()}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Verify your phone</DialogTitle>
          </DialogHeader>

          {otpStep === "send" ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                We&apos;re sending a 6-digit OTP to{" "}
                <span className="font-semibold text-foreground">{maskPhone(details.phone)}</span>.
              </p>
              {otpError ? (
                <p className="text-sm text-destructive">{otpError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{otpLoading ? "Sending…" : "Initialising…"}</p>
              )}
              <Button type="button" onClick={() => void sendOtp()} disabled={otpLoading}>
                {otpLoading ? "Sending…" : "Retry"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Enter the code sent to{" "}
                <span className="font-semibold text-foreground">{maskPhone(details.phone)}</span>
              </p>
              <p className="text-center text-sm font-semibold">{timer > 0 ? `${mm}:${ss}` : "00:00"}</p>

              <OtpInputRow
                otp={otp}
                otpLen={OTP_LEN}
                otpRefs={otpRefs}
                error={Boolean(otpError)}
                onChange={changeOtp}
                onKeyDown={keyDownOtp}
                onPaste={pasteOtp}
              />

              {otpError ? <p className="text-center text-sm text-destructive">{otpError}</p> : null}
              {otpInfo ? <p className="text-center text-xs text-success">{otpInfo}</p> : null}

              <Button
                type="button"
                className="h-12 w-full"
                onClick={() => void verifyAndSubmit()}
                disabled={otpLoading || otp.some((d) => d === "")}
              >
                {otpLoading ? "Verifying & registering…" : "Verify & Submit"}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={closeOtp}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                  disabled={otpLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void resend()}
                  disabled={timer > 0 || otpLoading}
                  className="font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AuthPageBackground>
  );
}
