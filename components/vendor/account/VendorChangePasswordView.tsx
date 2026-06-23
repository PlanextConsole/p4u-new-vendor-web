"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { authApi } from "@/lib/api/auth";
import { getStoredUsername } from "@/lib/authSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VendorFormLayout } from "@/components/vendor/VendorListUi";

export default function VendorChangePasswordView() {
  const router = useRouter();
  const pathname = usePathname();
  const dashRoot = pathname.includes("/dashboard/service") ? "/dashboard/service" : "/dashboard/product";

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const accountLabel = getStoredUsername() || "Vendor account";

  async function handleSubmit() {
    setErr("");
    setOk("");
    if (!currentPw.trim()) {
      setErr("Current password is required.");
      return;
    }
    if (newPw.length < 6) {
      setErr("New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setErr("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPw, newPw);
      setOk("Password updated successfully.");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setTimeout(() => router.back(), 1200);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <VendorFormLayout width="sm">
      <header className="flex items-center gap-3">
        <Link href={`${dashRoot}/profile`} className="rounded-lg p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Change Password</h1>
      </header>

      <div className="rounded-xl bg-muted/50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Account:</span>
          <span className="text-sm font-semibold">{accountLabel}</span>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{ok}</div>
      ) : null}

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set a new password for your vendor account. If you signed in with phone OTP only, use your initial password or
          contact support to reset it first.
        </p>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type={showCurrent ? "text" : "password"}
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="Current password"
            className="h-12 rounded-xl pl-10 pr-10"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => setShowCurrent((v) => !v)}
            aria-label={showCurrent ? "Hide password" : "Show password"}
          >
            {showCurrent ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type={showNew ? "text" : "password"}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password"
            className="h-12 rounded-xl pl-10 pr-10"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => setShowNew((v) => !v)}
            aria-label={showNew ? "Hide password" : "Show password"}
          >
            {showNew ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type={showConfirm ? "text" : "password"}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Confirm new password"
            className="h-12 rounded-xl pl-10 pr-10"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        <Button
          type="button"
          onClick={() => void handleSubmit()}
          className="h-12 w-full gap-2 rounded-xl text-base"
          disabled={saving || newPw.length < 6}
        >
          <ShieldCheck className="h-4 w-4" />
          {saving ? "Updating…" : "Update Password"}
        </Button>
      </div>
    </VendorFormLayout>
  );
}
