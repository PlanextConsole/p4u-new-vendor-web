/** Normalized bank account for vendor portal (stored under `catalog_vendors.bank_json`). */

export type VendorBankAccount = {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: string;
  isPrimary: boolean;
};

const ACCOUNT_TYPES = ["savings", "current"] as const;

export function accountTypeOptions(): { value: string; label: string }[] {
  return [
    { value: "savings", label: "Savings" },
    { value: "current", label: "Current" },
  ];
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Stable id for a newly added account row (client-side until persisted). */
export function newBankAccountId(): string {
  return newId();
}

/** Parse legacy flat `bankJson` or `{ version: 1, accounts: [...] }`. */
export function parseBankAccounts(bankJson: unknown): VendorBankAccount[] {
  if (!bankJson || typeof bankJson !== "object" || Array.isArray(bankJson)) return [];
  const o = bankJson as Record<string, unknown>;

  if (Array.isArray(o.accounts)) {
    const raw = o.accounts.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
    const mapped = raw.map((a) => normalizeAccountRow(a));
    return ensureSinglePrimary(mapped);
  }

  const legacyBank = String(o.bankName ?? "").trim();
  const legacyAcct = String(o.accountNumber ?? "").trim();
  const legacyHolder = String(o.accountHolderName ?? "").trim();
  const legacyIfsc = String(o.ifscCode ?? o.ifsc ?? "").trim();
  const hasLegacy = Boolean(legacyBank || legacyAcct || legacyHolder || legacyIfsc);
  if (hasLegacy) {
    const acc = normalizeAccountRow({
      id: "legacy",
      bankName: o.bankName,
      accountHolderName: o.accountHolderName,
      accountNumber: o.accountNumber,
      ifscCode: o.ifscCode ?? o.ifsc,
      accountType: o.accountType ?? "savings",
      isPrimary: true,
    });
    return [acc];
  }

  return [];
}

function normalizeAccountRow(a: Record<string, unknown>): VendorBankAccount {
  const id = typeof a.id === "string" && a.id.trim() ? a.id.trim() : newId();
  const bankName = String(a.bankName || "").trim();
  const accountHolderName = String(a.accountHolderName || "").trim();
  const accountNumber = String(a.accountNumber || "").trim();
  const ifscCode = String(a.ifscCode || a.ifsc || "").trim().toUpperCase();
  let accountType = String(a.accountType || "savings").toLowerCase();
  if (!ACCOUNT_TYPES.includes(accountType as (typeof ACCOUNT_TYPES)[number])) accountType = "savings";
  const isPrimary = Boolean(a.isPrimary);
  return { id, bankName, accountHolderName, accountNumber, ifscCode, accountType, isPrimary };
}

function ensureSinglePrimary(accounts: VendorBankAccount[]): VendorBankAccount[] {
  if (accounts.length === 0) return [];
  const primaryIdx = accounts.findIndex((a) => a.isPrimary);
  const idx = primaryIdx >= 0 ? primaryIdx : 0;
  return accounts.map((a, i) => ({ ...a, isPrimary: i === idx }));
}

export function serializeBankAccounts(accounts: VendorBankAccount[]): Record<string, unknown> {
  const normalized = ensureSinglePrimary(accounts);
  return {
    version: 1,
    accounts: normalized.map((a) => ({
      id: a.id,
      bankName: a.bankName,
      accountHolderName: a.accountHolderName,
      accountNumber: a.accountNumber,
      ifscCode: a.ifscCode,
      accountType: a.accountType,
      isPrimary: a.isPrimary,
    })),
  };
}

export function maskAccountNumber(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length <= 4) return "****";
  return `****${d.slice(-4)}`;
}

export function validateIfsc(code: string): string {
  const c = code.trim().toUpperCase();
  if (!c) return "IFSC code is required.";
  if (c.length !== 11) return "IFSC must be 11 characters.";
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(c)) return "Enter a valid IFSC (e.g. SBIN0001234).";
  return "";
}

/** Account numbers are 9–18 digits across Indian banks. */
export const ACCOUNT_NUMBER_MAX = 18;

/** Strip anything that is not allowed while typing a bank/holder name. */
export function sanitizeBankNameInput(raw: string): string {
  // Letters, spaces and the few punctuation marks real bank names use.
  return raw.replace(/[^A-Za-z .&'-]/g, "").replace(/\s{2,}/g, " ");
}

export function sanitizeAccountHolderInput(raw: string): string {
  // Personal/business holder names: letters, spaces and dots (initials) only.
  return raw.replace(/[^A-Za-z .]/g, "").replace(/\s{2,}/g, " ");
}

export function validateBankName(value: string): string {
  const v = value.trim();
  if (!v) return "Bank name is required.";
  if (v.length < 3) return "Bank name looks too short.";
  if (!/^[A-Za-z][A-Za-z .&'-]*$/.test(v)) {
    return "Bank name can only contain letters, spaces and . & ' -";
  }
  return "";
}

export function validateAccountHolderName(value: string): string {
  const v = value.trim();
  if (!v) return "Account holder name is required.";
  if (v.length < 3) return "Name looks too short.";
  if (!/^[A-Za-z][A-Za-z .]*$/.test(v)) {
    return "Name can only contain letters, spaces and dots.";
  }
  return "";
}

export function validateAccountNumber(value: string): string {
  const acct = value.replace(/\s/g, "");
  if (!acct) return "Account number is required.";
  if (!/^\d+$/.test(acct)) return "Account number can only contain digits.";
  if (acct.length < 9 || acct.length > ACCOUNT_NUMBER_MAX) {
    return `Enter a valid account number (9–${ACCOUNT_NUMBER_MAX} digits).`;
  }
  return "";
}
