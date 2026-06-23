"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { patchVendorProfile } from "@/lib/api/vendor";
import { signOutVendorCompletely } from "@/lib/authSession";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VendorFormLayout } from "@/components/vendor/VendorListUi";
import { cn } from "@/lib/utils";

export default function VendorAccountControlView() {
  const router = useRouter();
  const pathname = usePathname();
  const dashRoot = pathname.includes("/dashboard/service") ? "/dashboard/service" : "/dashboard/product";

  const [selected, setSelected] = useState<"deactivate" | "delete" | null>(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function handleContinue() {
    if (!selected) {
      setErr("Please select an option.");
      return;
    }
    setErr("");
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    setErr("");
    try {
      const stamp = new Date().toISOString();
      await patchVendorProfile({
        notes: JSON.stringify({
          accountControl: selected,
          reason: reason.trim() || null,
          requestedAt: stamp,
        }),
      });
      await signOutVendorCompletely();
      router.replace("/");
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Something went wrong");
      setConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <VendorFormLayout width="sm" className="pb-24 lg:pb-6">
      <div className="space-y-6">
        <div>
          <h2 className="mb-2 text-xl font-bold">Deactivating or deleting your P4U vendor account</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you want to take a break from selling on P4U, you can temporarily deactivate your vendor account. If you
            want to permanently delete your account, let us know. Your products and services will be removed from the
            marketplace after admin review.
          </p>
        </div>

        {err ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>
        ) : null}

        <Card
          className={cn(
            "cursor-pointer border-2 p-5 transition-all",
            selected === "deactivate" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
          )}
          onClick={() => setSelected("deactivate")}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="mb-1 text-base font-bold">Deactivate account</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Deactivating your vendor account is temporary,</span> and
                it means your store, products, and services will be hidden on P4U until admin reactivates your account.
              </p>
            </div>
            <div
              className={cn(
                "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                selected === "deactivate" ? "border-primary" : "border-muted-foreground/40",
              )}
            >
              {selected === "deactivate" ? <div className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
            </div>
          </div>
        </Card>

        <Card
          className={cn(
            "cursor-pointer border-2 p-5 transition-all",
            selected === "delete" ? "border-destructive bg-destructive/5" : "border-border hover:border-destructive/40",
          )}
          onClick={() => setSelected("delete")}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="mb-1 text-base font-bold">Delete account</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Deleting your vendor account is permanent.</span> When you
                delete your P4U vendor account, your store, products, services, order history, and settlements data will
                be permanently removed after the retention period.
              </p>
            </div>
            <div
              className={cn(
                "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                selected === "delete" ? "border-destructive" : "border-muted-foreground/40",
              )}
            >
              {selected === "delete" ? <div className="h-2.5 w-2.5 rounded-full bg-destructive" /> : null}
            </div>
          </div>
        </Card>

        {selected ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="account-reason">
              Reason (optional)
            </label>
            <textarea
              id="account-reason"
              placeholder={`Why would you like to ${selected === "deactivate" ? "deactivate" : "delete"} your vendor account?`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={3}
            />
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handleContinue}
          disabled={!selected}
          className="h-12 w-full rounded-xl text-base"
          variant={selected === "delete" ? "destructive" : "default"}
        >
          Continue
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          <button type="button" className="text-primary underline" onClick={() => router.push(`${dashRoot}/profile`)}>
            Back to profile
          </button>
        </p>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={cn("h-5 w-5", selected === "delete" ? "text-destructive" : "text-warning")} />
              {selected === "deactivate" ? "Deactivate Vendor Account?" : "Delete Vendor Account?"}
            </DialogTitle>
            <DialogDescription>
              {selected === "deactivate"
                ? "Your request will be sent to admin for review. You'll be logged out immediately."
                : "Your deletion request will be sent to admin. You'll be logged out immediately. This cannot be undone after processing."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={selected === "delete" ? "destructive" : "default"}
              className="rounded-xl"
              disabled={loading}
              onClick={() => void handleConfirm()}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {selected === "deactivate" ? "Deactivate" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VendorFormLayout>
  );
}
