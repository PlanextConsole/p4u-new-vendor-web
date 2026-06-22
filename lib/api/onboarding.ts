import { apiClient } from "./client";

const BASE = "/api/auth";

/** Shape mirrored from auth-management-services VendorOnboardingService. */
export interface VendorOnboardingPayload {
  vendorType: "SERVICE" | "PRODUCT";
  vendorKind?: "service" | "product";
  ownerName: string;
  businessName: string;
  email?: string | null;
  phone?: string | null;
  categoriesJson?: unknown;
  servicesJson?: unknown;
  gst?: string | null;
  pan?: string | null;
  addressJson?: Record<string, unknown> | null;
  documentsJson?: Record<string, unknown> | null;
  bankJson?: Record<string, unknown> | null;
  source?: string | null;
}

export interface VendorOnboardingRecord {
  id: string;
  status: string;
  requestType: string;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown> & VendorOnboardingPayload;
}

/** Fetch the latest vendor_signup_requests row authored by the current user. */
export function getMyVendorOnboarding(): Promise<VendorOnboardingRecord> {
  return apiClient.get<VendorOnboardingRecord>(`${BASE}/vendor/me/onboarding`);
}

/** Submit (or replace any pending) vendor_signup_requests row for current user. */
export function submitMyVendorOnboarding(
  payload: VendorOnboardingPayload,
): Promise<VendorOnboardingRecord> {
  return apiClient.post<VendorOnboardingRecord>(`${BASE}/vendor/me/onboarding`, payload);
}
