"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Phone,
  Store,
} from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { persistAuthSession, hasAccessToken } from "@/lib/authSession";
import { sendPhoneOtp, clearRecaptcha } from "@/lib/firebase";

const RECAPTCHA_ID = "p4u-vendor-recaptcha";
const OTP_LEN = 6;
const RESEND_S = 30;

type Step = "phone" | "otp";

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

function maskPhone(p: string) {
  const d = p.replace(/\D/g, "").slice(-10);
  return `+91-${d.slice(0, 3)}***${d.slice(-3)}`;
}

/** After Firebase accepts the OTP, server-side exchange can still fail (Keycloak, env). */
function formatPhoneExchangeError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  const msg = String(e.message || "").trim();
  const m = msg.toLowerCase();

  if (
    e.status === 503 ||
    m.includes("otp login failed") ||
    m.includes("identity server rejected") ||
    m.includes("direct access grants") ||
    m.includes("password-grant")
  ) {
    return msg.length > 0 && msg.length < 400
      ? msg
      : "Sign-in could not finish: the identity server rejected the request. In Keycloak, enable Direct access grants for the auth-management client and ensure KEYCLOAK_CLIENT_SECRET matches that client.";
  }
  if (m.includes("firebase admin not initialized") || m.includes("firebase_project_id")) {
    return "Phone sign-in is not configured on the server (Firebase Admin credentials missing).";
  }
  if (
    m === "http 401 unauthorized" ||
    m === "unauthorized" ||
    m.includes("request failed with status code 401")
  ) {
    return "OTP was verified, but issuing your session failed. Check Keycloak: Direct access grants ON for auth-management-client, and KEYCLOAK_CLIENT_SECRET matches the client.";
  }
  return msg || "Verification failed.";
}

export default function VendorLoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(""));
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredFlash, setRegisteredFlash] = useState(false);
  const [timer, setTimer] = useState(RESEND_S);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submitLock = useRef(false);

  useEffect(() => {
    if (hasAccessToken()) {
      router.replace("/dashboard/product");
    }
  }, [router]);

  useEffect(() => {
    if (searchParams?.get("registered") === "1") {
      setRegisteredFlash(true);
      const t = setTimeout(() => setRegisteredFlash(false), 8000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      // Tear down the verifier when the component unmounts so re-renders
      // don't collide on the same DOM node.
      clearRecaptcha();
    };
  }, []);

  useEffect(() => {
    if (step !== "otp" || timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [step, timer]);

  async function sendOtp() {
    if (submitLock.current) return;
    const v = validatePhone(phone);
    if (v) {
      setError(v);
      return;
    }
    setError("");
    setInfo("");
    submitLock.current = true;
    setLoading(true);
    try {
      const c = await sendPhoneOtp(toE164(phone), RECAPTCHA_ID);
      setConfirmation(c);
      setStep("otp");
      setOtp(Array(OTP_LEN).fill(""));
      setTimer(RESEND_S);
      setTimeout(() => otpRefs.current[0]?.focus(), 60);
    } catch (err: unknown) {
      const code = String((err as { code?: string })?.code || "");
      if (code.includes("too-many-requests")) {
        setError("Too many OTP attempts. Please try again later.");
      } else if (code.includes("invalid-phone-number")) {
        setError("Invalid phone number for OTP delivery.");
      } else if (code.includes("operation-not-allowed")) {
        setError(
          "Phone sign-in is not enabled in Firebase. Ask the admin to enable it.",
        );
      } else {
        setError(
          (err as { message?: string })?.message || "Failed to send OTP. Please retry.",
        );
      }
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!confirmation) {
      setError("OTP session expired. Please request a new code.");
      return;
    }
    if (otp.some((d) => d === "")) {
      setError("Please enter all 6 digits.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const cred = await confirmation.confirm(otp.join(""));
      const idToken = await cred.user.getIdToken();
      const res = await authApi.phoneExchange(idToken, "VENDOR");

      if (res.loggedIn) {
        persistAuthSession(res.auth, toE164(phone));
        setInfo("Login successful! Redirecting…");
        setTimeout(() => {
          router.replace("/dashboard/product");
        }, 280);
      } else if (res.registrationToken) {
        // No vendor account found for this phone. Park the verified Firebase
        // session details for /register to use at submit time and route the
        // user there with a friendly message.
        sessionStorage.setItem("p4u_vendor_register_phone", toE164(phone));
        setError("No vendor account found for this phone. Redirecting you to registration…");
        setTimeout(() => router.push("/register"), 900);
      } else {
        setError("Unexpected response from server. Please retry.");
      }
    } catch (err: unknown) {
      const code = String((err as { code?: string })?.code || "");
      if (code.includes("invalid-verification-code")) {
        setError("Incorrect OTP. Please try again.");
      } else if (code.includes("code-expired")) {
        setError("OTP expired. Please request a new one.");
      } else {
        setError(formatPhoneExchangeError(err));
      }
    } finally {
      setLoading(false);
    }
  }

  function changePhone() {
    clearRecaptcha();
    setStep("phone");
    setConfirmation(null);
    setOtp(Array(OTP_LEN).fill(""));
    setError("");
    setInfo("");
  }

  async function resend() {
    if (timer > 0 || loading) return;
    setInfo("");
    await sendOtp();
    setInfo("OTP resent. Please check your messages.");
  }

  function changeOtp(i: number, val: string) {
    const d = val.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    setError("");
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
    if (e.key === "Enter" && otp.every((d) => d !== "")) void verifyOtp();
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
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f0] px-4 py-10">
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]">
        <div className="bg-vendor-teal px-8 pb-9 pt-10 text-center text-white">
          <div className="mx-auto mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-2xl bg-white p-2 shadow-md ring-1 ring-white/20">
            <Image
              src="/logo.png"
              alt="P4U"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
              priority
            />
          </div>
          <div className="flex items-center justify-center gap-2.5">
            <Store className="h-6 w-6 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
            <h1 className="text-[1.35rem] font-bold tracking-tight">Vendor Portal</h1>
          </div>
          <p className="mt-2.5 text-sm font-normal leading-relaxed text-white/90">
            Manage your store, orders & settlements
          </p>
        </div>

        {registeredFlash ? (
          <div className="flex items-start gap-3 border-b border-emerald-100 bg-emerald-50 px-7 py-4 text-sm text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="font-semibold">Registration submitted</p>
              <p className="mt-0.5 text-xs text-emerald-800/80">
                Operations will review your application. You can sign in once your
                vendor account is approved.
              </p>
            </div>
          </div>
        ) : null}

        <div className="bg-white px-7 pb-8 pt-7">
          {step === "phone" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendOtp();
              }}
              className="space-y-5"
            >
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  Sign in with your mobile
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  We&apos;ll send a 6-digit OTP to your phone.
                </p>
              </div>

              <div className="flex gap-2">
                <div className="relative shrink-0">
                  <select
                    className="input h-[48px] cursor-pointer appearance-none pr-8 text-sm font-medium text-slate-800"
                    defaultValue="+91"
                    aria-label="Country code"
                  >
                    <option value="+91">IN +91</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
                <div className="relative flex-1">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                      if (error) setError("");
                    }}
                    className="input input-with-icon h-[48px] py-3 pl-10"
                  />
                </div>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-vendor-teal-soft to-vendor-teal text-[15px] font-semibold text-white shadow-md transition hover:brightness-95 disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? "Sending OTP…" : "Send OTP"}
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              </button>

              <p className="text-center text-xs text-slate-500">
                By continuing you agree to our Terms of Service and Privacy Policy.
              </p>

              <div id={RECAPTCHA_ID} />
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verifyOtp();
              }}
              className="space-y-5"
            >
              <div className="text-center">
                <h2 className="text-[15px] font-semibold text-slate-900">
                  OTP Verification
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Enter the 6-digit code sent to{" "}
                  <span className="font-semibold text-slate-700">{maskPhone(phone)}</span>
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-700">
                  {timer > 0 ? `${mm}:${ss}` : "00:00"}
                </p>
              </div>

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
                        : error
                          ? "border-red-400"
                          : "border-slate-200"
                    }`}
                  />
                ))}
              </div>

              {error ? (
                <p className="text-center text-sm text-red-600">{error}</p>
              ) : null}
              {info ? (
                <p className="text-center text-xs text-emerald-700">{info}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading || otp.some((d) => d === "")}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-vendor-teal-soft to-vendor-teal text-[15px] font-semibold text-white shadow-md transition hover:brightness-95 disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? "Verifying…" : "Verify & Sign in"}
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={changePhone}
                  className="text-slate-500 underline-offset-2 hover:underline"
                >
                  ← Change phone number
                </button>
                <button
                  type="button"
                  onClick={() => void resend()}
                  disabled={timer > 0 || loading}
                  className="font-semibold text-vendor-teal disabled:cursor-not-allowed disabled:opacity-50 hover:underline"
                >
                  {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-7 text-center text-sm text-slate-600">
            New vendor?{" "}
            <Link href="/register" className="font-semibold text-vendor-teal hover:underline">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
