"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { ArrowRight, CheckCircle2, ChevronDown, Loader2, Phone, Store } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { persistAuthSession } from "@/lib/authSession";
import { sendPhoneOtp, clearRecaptcha } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  AuthPageBackground,
  AuthCardHeader,
  OtpInputRow,
} from "@/components/auth/auth-ui";
import { cn } from "@/lib/utils";

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
    if (searchParams?.get("registered") === "1") {
      setRegisteredFlash(true);
      const t = setTimeout(() => setRegisteredFlash(false), 8000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => clearRecaptcha();
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
        setError("Phone sign-in is not enabled in Firebase. Ask the admin to enable it.");
      } else {
        setError((err as { message?: string })?.message || "Failed to send OTP. Please retry.");
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
        setTimeout(() => router.replace("/dashboard/product"), 280);
      } else if (res.registrationToken) {
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
    <AuthPageBackground>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Card className="overflow-hidden border-border/50 shadow-2xl">
            <AuthCardHeader
              title="Vendor Portal"
              subtitle="Manage your store, orders & settlements"
            />

            {registeredFlash ? (
              <div className="flex items-start gap-3 border-b border-success/20 bg-success/10 px-6 py-4 text-sm text-success">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Registration submitted</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    Operations will review your application. You can sign in once your vendor account is approved.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-5 p-6">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Store className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Phone OTP sign-in</span>
              </div>

              {step === "phone" ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendOtp();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Sign in with your mobile</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">We&apos;ll send a 6-digit OTP to your phone.</p>
                  </div>

                  <div className="flex gap-2">
                    <div className="relative shrink-0">
                      <select
                        className="flex h-11 w-[88px] cursor-pointer appearance-none rounded-xl border border-input bg-background px-2 pr-7 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                        defaultValue="+91"
                        aria-label="Country code"
                      >
                        <option value="+91">+91</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <div className="relative flex-1">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
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
                        className="h-11 pl-10"
                      />
                    </div>
                  </div>

                  {error ? <p className="text-sm text-destructive">{error}</p> : null}

                  <Button type="submit" className="h-12 w-full gap-2 text-base" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Sending OTP…
                      </>
                    ) : (
                      <>
                        Send OTP <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
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
                  className="space-y-4"
                >
                  <div className="text-center">
                    <h2 className="text-sm font-semibold text-foreground">OTP verification</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter the code sent to{" "}
                      <span className="font-semibold text-foreground">{maskPhone(phone)}</span>
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{timer > 0 ? `${mm}:${ss}` : "00:00"}</p>
                  </div>

                  <OtpInputRow
                    otp={otp}
                    otpLen={OTP_LEN}
                    otpRefs={otpRefs}
                    error={Boolean(error)}
                    onChange={changeOtp}
                    onKeyDown={keyDownOtp}
                    onPaste={pasteOtp}
                  />

                  {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
                  {info ? <p className="text-center text-xs text-success">{info}</p> : null}

                  <Button
                    type="submit"
                    className="h-12 w-full gap-2 text-base"
                    disabled={loading || otp.some((d) => d === "")}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                      </>
                    ) : (
                      <>
                        Verify & Sign in <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-xs">
                    <button type="button" onClick={changePhone} className="text-muted-foreground hover:text-foreground hover:underline">
                      ← Change phone number
                    </button>
                    <button
                      type="button"
                      onClick={() => void resend()}
                      disabled={timer > 0 || loading}
                      className={cn(
                        "font-semibold text-primary hover:underline",
                        (timer > 0 || loading) && "cursor-not-allowed opacity-50",
                      )}
                    >
                      {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
                    </button>
                  </div>
                </form>
              )}

              <p className="border-t border-border/40 pt-4 text-center text-sm text-muted-foreground">
                New vendor?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Register here
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AuthPageBackground>
  );
}
