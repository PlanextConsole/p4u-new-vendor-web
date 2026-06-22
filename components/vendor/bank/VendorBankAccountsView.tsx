"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getVendorMe, patchVendorProfile, type VendorProfile } from "@/lib/api/vendor";
import {
  accountTypeOptions,
  maskAccountNumber,
  newBankAccountId,
  parseBankAccounts,
  serializeBankAccounts,
  validateIfsc,
  type VendorBankAccount,
} from "@/lib/vendor/bankAccounts";

const inputClass = "mt-2";

function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong. Try again.";
}

export default function VendorBankAccountsView() {
  const [me, setMe] = useState<VendorProfile | null>(null);
  const [accounts, setAccounts] = useState<VendorBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountType: "savings",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const readOnly = me?.source === "onboarding";

  const load = useCallback(async () => {
    setLoading(true);
    setBanner("");
    try {
      const profile = await getVendorMe();
      setMe(profile);
      setAccounts(parseBankAccounts(profile.bankJson));
    } catch (e: unknown) {
      setBanner(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: VendorBankAccount[]) {
    if (!me || readOnly) return;
    setSaving(true);
    setBanner("");
    try {
      const body = serializeBankAccounts(next);
      const updated = await patchVendorProfile({ bankJson: body });
      setMe(updated);
      setAccounts(parseBankAccounts(updated.bankJson));
    } catch (e: unknown) {
      setBanner(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function openAdd() {
    setFormErrors({});
    setForm({
      bankName: "",
      accountHolderName: "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifscCode: "",
      accountType: "savings",
    });
    setModalOpen(true);
  }

  function validateForm(): boolean {
    const e: Record<string, string> = {};
    if (!form.bankName.trim()) e.bankName = "Bank name is required.";
    if (!form.accountHolderName.trim()) e.accountHolderName = "Account holder name is required.";
    const acct = form.accountNumber.replace(/\s/g, "");
    if (!acct) e.accountNumber = "Account number is required.";
    if (acct && !/^\d{6,18}$/.test(acct)) e.accountNumber = "Enter a valid account number (6–18 digits).";
    const cfm = form.confirmAccountNumber.replace(/\s/g, "");
    if (!cfm) e.confirmAccountNumber = "Confirm your account number.";
    if (acct && cfm && acct !== cfm) e.confirmAccountNumber = "Account numbers do not match.";
    const ifscErr = validateIfsc(form.ifscCode);
    if (ifscErr) e.ifscCode = ifscErr;
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submitAdd() {
    if (!validateForm()) return;
    const acct = form.accountNumber.replace(/\s/g, "");
    const ifsc = form.ifscCode.trim().toUpperCase();
    const row: VendorBankAccount = {
      id: newBankAccountId(),
      bankName: form.bankName.trim(),
      accountHolderName: form.accountHolderName.trim(),
      accountNumber: acct,
      ifscCode: ifsc,
      accountType: form.accountType,
      isPrimary: accounts.length === 0,
    };
    const next = [...accounts, row];
    setModalOpen(false);
    await persist(next);
  }

  async function removeAccount(id: string) {
    const next = accounts.filter((a) => a.id !== id);
    await persist(next);
    setConfirmDeleteId(null);
  }

  async function setPrimary(id: string) {
    const next = accounts.map((a) => ({ ...a, isPrimary: a.id === id }));
    await persist(next);
  }

  if (loading) {
    return (
      <div className="min-w-0 space-y-4 py-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base text-muted-foreground">Manage your bank accounts for settlement payouts.</p>
        </div>
        <Button type="button" onClick={() => openAdd()} disabled={readOnly || saving} className="shrink-0 gap-2 self-start">
          <Plus className="h-5 w-5 shrink-0" aria-hidden />
          Add Account
        </Button>
      </div>

      {readOnly ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Your profile is still pending approval. Bank details shown here come from your application. After approval,
          you can add or remove accounts from this page.{" "}
          <Link href="/onboarding" className="font-semibold text-primary underline">
            Edit application
          </Link>
        </div>
      ) : null}

      {banner ? <p className="text-sm text-destructive">{banner}</p> : null}

      {accounts.length === 0 ? (
        <Card className="border-dashed px-6 py-14 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="mt-3 text-base font-medium text-foreground">No bank accounts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add an account to receive settlement payouts.</p>
        </Card>
      ) : (
        <ul className="space-y-4">
          {accounts.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-wrap items-start gap-4 border-primary/25 bg-primary/5 px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-card text-primary shadow-sm ring-1 ring-primary/20">
                <CreditCard className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{a.bankName || "—"}</span>
                  {a.isPrimary ? (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                      Primary
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving || readOnly}
                      onClick={() => void setPrimary(a.id)}
                      className="h-auto rounded-full px-2.5 py-0.5 text-xs"
                    >
                      Make primary
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-base text-foreground">{a.accountHolderName || "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A/C: {maskAccountNumber(a.accountNumber)} • IFSC: {a.ifscCode || "—"} • {a.accountType}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
                {confirmDeleteId === a.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card/90 px-2 py-2 shadow-sm ring-1 ring-border">
                    <span className="text-xs font-medium text-foreground">Remove this account?</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => void removeAccount(a.id)} disabled={saving || readOnly}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={readOnly || saving}
                    onClick={() => setConfirmDeleteId(a.id)}
                    className="text-destructive hover:text-destructive"
                    aria-label="Delete bank account"
                  >
                    <Trash2 className="h-5 w-5" aria-hidden />
                  </Button>
                )}
              </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 sm:p-6"
          onClick={() => setModalOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-add-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="bank-add-title" className="text-xl font-bold text-foreground sm:text-2xl">
                Add bank account
              </h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setModalOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Details are stored securely for payouts.</p>

            <div className="mt-6 space-y-5">
              <label className="block">
                <Label>Bank Name</Label>
                <Input
                  className={inputClass}
                  placeholder="e.g. State Bank of India"
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  autoComplete="organization"
                />
                {formErrors.bankName ? <p className="mt-1 text-sm text-destructive">{formErrors.bankName}</p> : null}
              </label>
              <label className="block">
                <Label>Account Holder Name</Label>
                <Input
                  className={inputClass}
                  value={form.accountHolderName}
                  onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
                  autoComplete="name"
                />
                {formErrors.accountHolderName ? (
                  <p className="mt-1 text-sm text-destructive">{formErrors.accountHolderName}</p>
                ) : null}
              </label>
              <label className="block">
                <Label>Account Number</Label>
                <Input
                  className={inputClass}
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))}
                />
                {formErrors.accountNumber ? (
                  <p className="mt-1 text-sm text-destructive">{formErrors.accountNumber}</p>
                ) : null}
              </label>
              <label className="block">
                <Label>Confirm Account Number</Label>
                <Input
                  className={inputClass}
                  placeholder="Re-enter account number"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.confirmAccountNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, confirmAccountNumber: e.target.value.replace(/\D/g, "") }))
                  }
                />
                {formErrors.confirmAccountNumber ? (
                  <p className="mt-1 text-sm text-destructive">{formErrors.confirmAccountNumber}</p>
                ) : null}
              </label>
              <label className="block">
                <Label>IFSC Code</Label>
                <Input
                  className={inputClass}
                  placeholder="e.g. SBIN0001234"
                  value={form.ifscCode}
                  onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                  maxLength={11}
                  autoComplete="off"
                />
                {formErrors.ifscCode ? <p className="mt-1 text-sm text-destructive">{formErrors.ifscCode}</p> : null}
              </label>
              <label className="block">
                <Label>Account Type</Label>
                <div className="relative mt-2">
                  <select
                    className="flex h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={form.accountType}
                    onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}
                  >
                    {accountTypeOptions().map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">▾</span>
                </div>
              </label>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={() => void submitAdd()}>
                Save account
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
