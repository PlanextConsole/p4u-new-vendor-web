"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { ArrowLeft, ArrowRight, Store, X } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { clearAuthSession, persistAuthSession } from "@/lib/authSession";
import { clearRecaptcha, sendPhoneOtp, signOutVendorFirebase } from "@/lib/firebase";

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
    <div className="min-h-screen bg-[#f5f6f4] pb-12 pt-8">
      <div className="mx-auto max-w-3xl px-4">
        <header className="mb-8 flex items-center gap-3">
          <Link href="/" className="rounded-lg p-2 hover:bg-white">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-vendor-teal text-white">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Vendor Registration</h1>
            <p className="text-sm text-slate-500">
              {vendorKind === "SERVICE" ? "Service vendor" : "Product vendor"}
            </p>
          </div>
        </header>

        <div className="mb-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                i === step
                  ? "bg-vendor-teal text-white"
                  : i < step
                    ? "bg-teal-50 text-vendor-teal-dark"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-card">
          {step === 0 && (
            <section className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">Details</h2>
              <p className="text-sm text-slate-600">
                Sign-in is via mobile OTP — no username or password to remember. We
                will verify your phone at the end of this form.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Owner Name *">
                  <input
                    className="input"
                    value={details.ownerName}
                    onChange={(e) => setDetails({ ...details, ownerName: e.target.value })}
                  />
                </Field>
                <Field label="Business Name *">
                  <input
                    className="input"
                    value={details.businessName}
                    onChange={(e) => setDetails({ ...details, businessName: e.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    className="input"
                    value={details.email}
                    onChange={(e) => setDetails({ ...details, email: e.target.value })}
                  />
                </Field>
                <Field label="Mobile (10 digits) *">
                  <input
                    className="input"
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
                </Field>
                <Field label="Vendor Type *">
                  <select
                    className="input"
                    value={vendorKind}
                    onChange={(e) => setVendorKind(e.target.value as VendorKindChoice)}
                  >
                    <option value="PRODUCT">Product Vendor</option>
                    <option value="SERVICE">Service Vendor</option>
                  </select>
                </Field>
                {vendorKind === "PRODUCT" ? (
                  <Field label="Vendor Category">
                    <input
                      className="input"
                      placeholder="e.g. groceries, electronics"
                      value={details.categorySlug}
                      onChange={(e) =>
                        setDetails({ ...details, categorySlug: e.target.value })
                      }
                    />
                  </Field>
                ) : (
                  <Field label="Services">
                    <input
                      className="input"
                      placeholder="e.g. salon, plumbing"
                      value={details.serviceName}
                      onChange={(e) =>
                        setDetails({ ...details, serviceName: e.target.value })
                      }
                    />
                  </Field>
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
                  <Field label="GSTIN (15 chars)">
                    <input
                      className="input"
                      maxLength={15}
                      value={details.gst}
                      onChange={(e) => setDetails({ ...details, gst: e.target.value })}
                    />
                  </Field>
                  <Field label="PAN (10 chars)">
                    <input
                      className="input"
                      maxLength={10}
                      value={details.pan}
                      onChange={(e) => setDetails({ ...details, pan: e.target.value })}
                    />
                  </Field>
                  <Field label="State Name (place of supply)">
                    <input
                      className="input"
                      value={details.stateName}
                      onChange={(e) => setDetails({ ...details, stateName: e.target.value })}
                    />
                  </Field>
                  <Field label="State Code (2 digits)">
                    <input
                      className="input"
                      maxLength={2}
                      value={details.stateCode}
                      onChange={(e) => setDetails({ ...details, stateCode: e.target.value })}
                    />
                  </Field>
                  <Field
                    label="Registered Shop Address (printed on invoice)"
                    className="sm:col-span-2"
                  >
                    <input
                      className="input"
                      value={details.registeredShopAddress}
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          registeredShopAddress: e.target.value,
                        })
                      }
                    />
                  </Field>
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
                <Field label="GST Certificate">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="input"
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
                </Field>
                <Field label="PAN Card">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="input"
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
                </Field>
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
                <Field label="Bank Name">
                  <input
                    className="input"
                    value={bank.bankName}
                    onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
                  />
                </Field>
                <Field label="IFSC">
                  <input
                    className="input"
                    value={bank.ifscCode}
                    onChange={(e) => setBank({ ...bank, ifscCode: e.target.value })}
                  />
                </Field>
                <Field label="Account Holder">
                  <input
                    className="input"
                    value={bank.accountHolderName}
                    onChange={(e) => setBank({ ...bank, accountHolderName: e.target.value })}
                  />
                </Field>
                <Field label="Account Number">
                  <input
                    className="input"
                    value={bank.accountNumber}
                    onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
                  />
                </Field>
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

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

          <div className="mt-8 flex justify-between gap-4">
            <button
              type="button"
              onClick={back}
              disabled={step === 0 || loading}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-vendor-teal px-6 py-2.5 text-sm font-medium text-white hover:bg-vendor-teal-dark disabled:opacity-60"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void openOtpAndSend()}
                disabled={loading}
                className="rounded-xl bg-vendor-teal px-6 py-2.5 text-sm font-medium text-white hover:bg-vendor-teal-dark disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Verify phone & Submit"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* OTP modal — opens when vendor clicks Submit on Review */}
      {/*
        reCAPTCHA container must exist in the DOM before the first OTP send.
        If it only lived inside the modal, the first `sendOtp` ran before paint
        and Firebase threw auth/argument-error; Retry worked after the modal rendered.
      */}
      <div id={RECAPTCHA_ID} className="sr-only" aria-hidden="true" />

      {otpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Verify your phone
              </h3>
              <button
                type="button"
                onClick={closeOtp}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              {otpStep === "send" ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-slate-600">
                    We&apos;re sending a 6-digit OTP to{" "}
                    <span className="font-semibold text-slate-800">
                      {maskPhone(details.phone)}
                    </span>
                    .
                  </p>
                  {otpError ? (
                    <p className="text-sm text-red-600">{otpError}</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {otpLoading ? "Sending…" : "Initialising…"}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void sendOtp()}
                    disabled={otpLoading}
                    className="rounded-xl bg-vendor-teal px-5 py-2 text-sm font-semibold text-white hover:bg-vendor-teal-dark disabled:opacity-60"
                  >
                    {otpLoading ? "Sending…" : "Retry"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-sm text-slate-600">
                    Enter the code sent to{" "}
                    <span className="font-semibold text-slate-800">
                      {maskPhone(details.phone)}
                    </span>
                  </p>
                  <p className="text-center text-sm font-semibold text-slate-700">
                    {timer > 0 ? `${mm}:${ss}` : "00:00"}
                  </p>
                  <div className="flex justify-center gap-2" onPaste={pasteOtp}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => {
                          otpRefs.current[i] = el;
                        }}
                        type="tel"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => changeOtp(i, e.target.value)}
                        onKeyDown={(e) => keyDownOtp(i, e)}
                        className={`h-12 w-10 rounded-lg border-[1.5px] text-center text-base font-semibold text-slate-900 outline-none transition ${
                          digit
                            ? "border-vendor-teal shadow-[0_0_0_3px_rgba(13,148,136,0.08)]"
                            : otpError
                              ? "border-red-400"
                              : "border-slate-200"
                        }`}
                      />
                    ))}
                  </div>

                  {otpError ? (
                    <p className="text-center text-sm text-red-600">{otpError}</p>
                  ) : null}
                  {otpInfo ? (
                    <p className="text-center text-xs text-emerald-700">{otpInfo}</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void verifyAndSubmit()}
                    disabled={otpLoading || otp.some((d) => d === "")}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-vendor-teal text-sm font-semibold text-white hover:bg-vendor-teal-dark disabled:opacity-60"
                  >
                    {otpLoading ? "Verifying & registering…" : "Verify & Submit"}
                  </button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={closeOtp}
                      className="text-slate-500 underline-offset-2 hover:underline"
                      disabled={otpLoading}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void resend()}
                      disabled={timer > 0 || otpLoading}
                      className="font-semibold text-vendor-teal disabled:cursor-not-allowed disabled:opacity-50 hover:underline"
                    >
                      {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-100 py-2">
      <span className="min-w-[140px] font-medium text-slate-500">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}
