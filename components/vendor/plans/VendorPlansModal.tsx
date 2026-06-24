"use client";

import { useEffect, useState } from "react";
import { Check, Crown, Loader2, X } from "lucide-react";
import { vendorPlanApi, type VendorPlanOption } from "@/lib/api/vendorPlan";

declare global {
  interface Window {
    // Razorpay Checkout global, injected by checkout.js
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function inr(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n === 0 ? "Free" : `₹${n.toLocaleString("en-IN")}`;
}

export default function VendorPlansModal({
  open,
  onClose,
  currentPlanId,
  vendor,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  currentPlanId?: string | null;
  vendor?: { name?: string | null; email?: string | null; phone?: string | null };
  onSuccess?: () => void;
}) {
  const [plans, setPlans] = useState<VendorPlanOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr("");
    setOk("");
    vendorPlanApi
      .listPlans()
      .then((res) => {
        if (cancelled) return;
        setPlans(res.items || []);
        setSelected(currentPlanId || res.items?.[0]?.id || "");
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load plans");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentPlanId]);

  async function subscribe() {
    if (!selected || paying) return;
    setPaying(true);
    setErr("");
    setOk("");
    try {
      const res = await vendorPlanApi.checkout(selected);
      if (res.free) {
        setOk(`Switched to ${res.plan.planName}.`);
        onSuccess?.();
        setTimeout(onClose, 900);
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) {
        setErr("Could not load the payment gateway. Check your connection and try again.");
        return;
      }

      const rzp = new window.Razorpay({
        key: res.keyId,
        amount: res.amount,
        currency: res.currency,
        order_id: res.orderId,
        name: "P4U Vendor Plan",
        description: res.plan.planName,
        prefill: {
          name: vendor?.name || undefined,
          email: vendor?.email || undefined,
          contact: vendor?.phone || undefined,
        },
        theme: { color: "#2563eb" },
        handler: async (resp: Record<string, string>) => {
          try {
            const verify = await vendorPlanApi.verify({
              planId: selected,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            if (verify.verified) {
              setOk(`Payment successful — ${res.plan.planName} is now active.`);
              onSuccess?.();
              setTimeout(onClose, 1200);
            } else {
              setErr("Payment could not be verified. If you were charged, contact support.");
            }
          } catch (e: unknown) {
            setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Verification failed.");
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.open();
      return; // paying stays true until handler/dismiss resolves
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Could not start checkout.");
    } finally {
      // For the paid path we keep `paying` until Razorpay resolves; only clear here for free/early errors.
      if (!window.Razorpay) setPaying(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plans-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="plans-title" className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Crown className="h-5 w-5 text-primary" aria-hidden />
            Choose your plan
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {err ? <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
          {ok ? <p className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{ok}</p> : null}

          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Loading plans…</p>
          ) : plans.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No plans are available right now.</p>
          ) : (
            <fieldset className="space-y-3">
              <legend className="sr-only">Available plans</legend>
              {plans.map((p) => {
                const active = selected === p.id;
                const isCurrent = currentPlanId === p.id;
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                      active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="vendor-plan"
                      value={p.id}
                      checked={active}
                      onChange={() => setSelected(p.id)}
                      className="mt-1 h-4 w-4 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-foreground">{p.planName}</span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Tier {p.tier} · {p.planType}
                        </span>
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                            <Check className="h-3 w-3" /> Current
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        Commission {p.commissionPercent}% · Redemption up to {p.maxUserRedemptionPercent}%
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="text-lg font-bold text-foreground">{inr(p.price)}</span>
                      {Number(p.price) > 0 ? <span className="block text-xs text-muted-foreground">/ month</span> : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void subscribe()}
            disabled={paying || loading || !selected || selected === currentPlanId}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {selected === currentPlanId ? "Current plan" : paying ? "Processing…" : "Subscribe"}
          </button>
        </div>
      </div>
    </div>
  );
}
