import { apiClient, type ApiErrorShape } from "./client";
import { getMyVendorOnboarding, type VendorOnboardingRecord } from "./onboarding";
import { VENDOR_AUTH } from "@/lib/storageKeys";

const BASE = "/api/v1/vendor";

export type VendorTypeApi = "PRODUCT" | "SERVICE";

export interface VendorProfile {
  id: string;
  businessName: string;
  ownerName: string;
  vendorType: VendorTypeApi;
  vendorKind?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  kycStatus?: string;
  addressJson?: Record<string, unknown> | null;
  categoriesJson?: unknown;
  servicesJson?: unknown;
  bankJson?: Record<string, unknown> | null;
  documentsJson?: Record<string, unknown> | null;
  /** Where this profile was loaded from. "onboarding" rows are admin-pending. */
  source?: "catalog" | "onboarding";
  /** Onboarding request status when source === "onboarding" (pending|approved|rejected). */
  onboardingStatus?: string;
  [key: string]: unknown;
}

/** Convert a vendor_signup_requests row into a soft VendorProfile so the
 *  dashboard can render while the catalog vendor row hasn't been provisioned. */
function onboardingToProfile(rec: VendorOnboardingRecord): VendorProfile {
  const p = rec.payload || {};
  const vt = String(p.vendorType || p.vendorKind || "").toUpperCase() === "PRODUCT"
    ? "PRODUCT"
    : "SERVICE";
  return {
    id: `pending-${rec.id}`,
    businessName: String(p.businessName || ""),
    ownerName: String(p.ownerName || ""),
    vendorType: vt,
    vendorKind: vt === "SERVICE" ? "service" : "product",
    email: typeof p.email === "string" ? p.email : null,
    phone: typeof p.phone === "string" ? p.phone : null,
    status: "pending",
    kycStatus: "pending",
    addressJson:
      p.addressJson && typeof p.addressJson === "object"
        ? (p.addressJson as Record<string, unknown>)
        : null,
    categoriesJson: p.categoriesJson ?? null,
    servicesJson: p.servicesJson ?? null,
    bankJson:
      p.bankJson && typeof p.bankJson === "object" && !Array.isArray(p.bankJson)
        ? (p.bankJson as Record<string, unknown>)
        : null,
    documentsJson:
      p.documentsJson && typeof p.documentsJson === "object" && !Array.isArray(p.documentsJson)
        ? (p.documentsJson as Record<string, unknown>)
        : null,
    source: "onboarding",
    onboardingStatus: rec.status,
  };
}

function isHttpStatus(err: unknown, status: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as ApiErrorShape).status === status
  );
}

/**
 * Authenticated vendor profile.
 *
 * Resolution order:
 *   1. Real catalog vendor row from vendor-management-service `/api/v1/vendor/me`.
 *   2. Pending onboarding row from auth-management-service
 *      `/api/auth/vendor/me/onboarding` (lets users with login but no catalog
 *      row keep using the portal until admin approval).
 *
 * Throws if neither exists, so callers can route to /onboarding.
 */
export async function getVendorMe(): Promise<VendorProfile> {
  try {
    const real = await apiClient.getInternal<VendorProfile>(`${BASE}/me`, {
      softAuthFailure: true,
      timeoutMs: 12_000,
    });
    const vt = String(real.vendorType || "").toUpperCase();
    if (typeof window !== "undefined" && vt) {
      localStorage.setItem(VENDOR_AUTH.vendorType, vt);
    }
    return { ...real, source: "catalog" };
  } catch (err) {
    if (isHttpStatus(err, 401)) throw err;
    // Only fall back to onboarding when there is no catalog vendor row (404).
    // On 502/503/504 the vendor service is down — fail fast instead of a second slow call.
    if (!isHttpStatus(err, 404)) throw err;
    try {
      const rec = await getMyVendorOnboarding();
      const profile = onboardingToProfile(rec);
      const vt = profile.vendorType;
      if (typeof window !== "undefined" && vt) {
        localStorage.setItem(VENDOR_AUTH.vendorType, vt);
      }
      return profile;
    } catch (fallbackErr) {
      if (isHttpStatus(fallbackErr, 401)) throw fallbackErr;
      throw err;
    }
  }
}

export interface VendorRegistrationPayload {
  businessName: string;
  ownerName: string;
  email?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  businessType?: string | null;
  gst?: string | null;
  pan?: string | null;
  address?: Record<string, unknown> | null;
  documents?: unknown;
  categories?: unknown;
  services?: unknown;
  description?: string | null;
  aboutBusiness?: string | null;
  bankJson?: Record<string, unknown> | null;
}

/** Requires CUSTOMER role + vendor.register (signup as customer before onboarding). */
export function submitVendorRegistration(body: VendorRegistrationPayload) {
  return apiClient.post<unknown>(`${BASE}/register`, body);
}

export function getRegistrationStatus() {
  return apiClient.get<unknown>(`${BASE}/register/status`);
}

/** Partial profile update (e.g. `bankJson`). Catalog vendors only — onboarding rows cannot PATCH `/me`. */
export function patchVendorProfile(body: Record<string, unknown>) {
  return apiClient.patch<VendorProfile>(`${BASE}/me`, body);
}
