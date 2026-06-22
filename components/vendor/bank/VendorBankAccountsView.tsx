"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Plus, Trash2, X } from "lucide-react";
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

const inputClass =
  "mt-2 block w-full rounded-full border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#20a090] focus:ring-2 focus:ring-[#20a090]/25";

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
      <div className="min-w-0 py-12 text-center text-base text-slate-600">Loading bank accounts…</div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base text-slate-500">Manage your bank accounts for settlement payouts.</p>
        </div>
        <button
          type="button"
          onClick={() => openAdd()}
          disabled={readOnly || saving}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#20a090] px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-[#188a7c] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-5 w-5 shrink-0" aria-hidden />
          Add Account
        </button>
      </div>

      {readOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Your profile is still pending approval. Bank details shown here come from your application. After approval,
          you can add or remove accounts from this page.{" "}
          <Link href="/onboarding" className="font-semibold text-[#0f766e] underline">
            Edit application
          </Link>
        </div>
      ) : null}

      {banner ? <p className="text-sm text-red-600">{banner}</p> : null}

      {accounts.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <CreditCard className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-base font-medium text-slate-700">No bank accounts yet</p>
          <p className="mt-1 text-sm text-slate-500">Add an account to receive settlement payouts.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start gap-4 rounded-[14px] border border-[#20a090]/25 bg-[#20a090]/10 px-4 py-4 sm:px-5 sm:py-5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#20a090] shadow-sm ring-1 ring-[#20a090]/20">
                <CreditCard className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-slate-900">{a.bankName || "—"}</span>
                  {a.isPrimary ? (
                    <span className="rounded-full bg-[#20a090] px-2.5 py-0.5 text-xs font-semibold text-white">
                      Primary
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={saving || readOnly}
                      onClick={() => void setPrimary(a.id)}
                      className="rounded-full border border-[#20a090]/40 bg-white px-2.5 py-0.5 text-xs font-semibold text-[#0f766e] hover:bg-white/80 disabled:opacity-50"
                    >
                      Make primary
                    </button>
                  )}
                </div>
                <p className="mt-1 text-base text-slate-800">{a.accountHolderName || "—"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  A/C: {maskAccountNumber(a.accountNumber)} • IFSC: {a.ifscCode || "—"} • {a.accountType}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
                {confirmDeleteId === a.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/90 px-2 py-2 shadow-sm ring-1 ring-slate-200">
                    <span className="text-xs font-medium text-slate-700">Remove this account?</span>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                      onClick={() => void removeAccount(a.id)}
                      disabled={saving || readOnly}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={readOnly || saving}
                    onClick={() => setConfirmDeleteId(a.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-40"
                    aria-label="Delete bank account"
                  >
                    <Trash2 className="h-5 w-5" aria-hidden />
                  </button>
                )}
              </div>
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
            className="max-h-[min(92vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bank-add-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="bank-add-title" className="text-xl font-bold text-slate-900 sm:text-2xl">
                Add bank account
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">Details are stored securely for payouts.</p>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="text-base font-semibold text-slate-900">Bank Name</span>
                <input
                  className={inputClass}
                  placeholder="e.g. State Bank of India"
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  autoComplete="organization"
                />
                {formErrors.bankName ? <p className="mt-1 text-sm text-red-600">{formErrors.bankName}</p> : null}
              </label>
              <label className="block">
                <span className="text-base font-semibold text-slate-900">Account Holder Name</span>
                <input
                  className={inputClass}
                  value={form.accountHolderName}
                  onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value }))}
                  autoComplete="name"
                />
                {formErrors.accountHolderName ? (
                  <p className="mt-1 text-sm text-red-600">{formErrors.accountHolderName}</p>
                ) : null}
              </label>
              <label className="block">
                <span className="text-base font-semibold text-slate-900">Account Number</span>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.accountNumber}
                  onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))}
                />
                {formErrors.accountNumber ? (
                  <p className="mt-1 text-sm text-red-600">{formErrors.accountNumber}</p>
                ) : null}
              </label>
              <label className="block">
                <span className="text-base font-semibold text-slate-900">Confirm Account Number</span>
                <input
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
                  <p className="mt-1 text-sm text-red-600">{formErrors.confirmAccountNumber}</p>
                ) : null}
              </label>
              <label className="block">
                <span className="text-base font-semibold text-slate-900">IFSC Code</span>
                <input
                  className={inputClass}
                  placeholder="e.g. SBIN0001234"
                  value={form.ifscCode}
                  onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                  maxLength={11}
                  autoComplete="off"
                />
                {formErrors.ifscCode ? <p className="mt-1 text-sm text-red-600">{formErrors.ifscCode}</p> : null}
              </label>
              <label className="block">
                <span className="text-base font-semibold text-slate-900">Account Type</span>
                <div className="relative mt-2">
                  <select
                    className={`${inputClass} appearance-none pr-10`}
                    value={form.accountType}
                    onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value }))}
                  >
                    {accountTypeOptions().map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">▾</span>
                </div>
              </label>
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full border border-slate-200 px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitAdd()}
                className="rounded-full bg-[#20a090] px-6 py-3 text-base font-semibold text-white hover:bg-[#188a7c] disabled:opacity-60"
              >
                Save account
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
