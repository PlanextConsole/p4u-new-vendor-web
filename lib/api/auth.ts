import { apiClient } from "./client";

const BASE = "/api/auth";

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  refreshExpiresIn?: number;
  roles?: string[];
  permissions?: string[];
  vendorId?: string | null;
  customerId?: string | null;
}

export interface PhoneExchangeLoggedInResponse {
  loggedIn: true;
  phone: string;
  auth: LoginResponse;
  intendedRole: "CUSTOMER" | "VENDOR";
}

export interface PhoneExchangeNeedsRegistrationResponse {
  loggedIn: false;
  phone: string;
  registrationToken: string;
  intendedRole: "CUSTOMER" | "VENDOR";
}

export type PhoneExchangeResponse =
  | PhoneExchangeLoggedInResponse
  | PhoneExchangeNeedsRegistrationResponse;

/**
 * Vendor self-registration payload. Mirrors the catalog_vendors columns admin
 * already understands. Submitted in one shot at the end of the vendor wizard
 * along with a fresh Firebase ID token (OTP-LAST flow).
 */
export interface RegisterVendorByPhonePayload {
  firebaseIdToken: string;
  vendorKind: "service" | "product" | "both";
  vendorType: "SERVICE" | "PRODUCT" | "BOTH";
  ownerName: string;
  businessName: string;
  email?: string | null;
  phone?: string | null;
  gst?: string | null;
  pan?: string | null;
  categoriesJson?: unknown;
  servicesJson?: unknown;
  addressJson?: Record<string, unknown> | null;
  documentsJson?: Record<string, unknown> | null;
  bankJson?: Record<string, unknown> | null;
}

/** No-OTP vendor registration payload — business details only, no Firebase token. */
export type RegisterVendorPayload = Omit<RegisterVendorByPhonePayload, "firebaseIdToken"> & {
  phone: string;
};

/** Vendor account state for the login pre-check. */
export type VendorAccountStatus = "not_registered" | "pending" | "approved" | "rejected";

export const authApi = {
  /**
   * Step 1 of phone-OTP login. The browser already verified the OTP via
   * Firebase Phone Auth and got an ID token. We send that ID token here, the
   * backend verifies it, and either:
   *   • returns Keycloak tokens directly (existing vendor → instant login), or
   *   • returns a short-lived registrationToken (new vendor → wizard).
   */
  phoneExchange(idToken: string, intendedRole: "VENDOR" | "CUSTOMER" = "VENDOR") {
    return apiClient.postInternal<PhoneExchangeResponse>(
      `${BASE}/public/phone/exchange`,
      { idToken, intendedRole },
      { skipAuthHeader: true, skipAuthRefresh: true },
    );
  },

  /**
   * Pre-OTP check: is this phone already a registered vendor? Used by the login
   * screen so we don't send an SMS OTP to a number that has no vendor account.
   */
  vendorPhoneStatus(phone: string) {
    return apiClient.postInternal<{ registered: boolean; status: VendorAccountStatus }>(
      `${BASE}/public/vendor/phone-status`,
      { phone },
      { skipAuthHeader: true, skipAuthRefresh: true },
    );
  },

  /**
   * No-OTP vendor self-registration. Submits the wizard fields; the backend
   * records a pending request for admin approval and creates no account. The
   * vendor signs in via OTP only after approval.
   */
  registerVendor(payload: RegisterVendorPayload) {
    return apiClient.postInternal<{ status: string; message: string }>(
      `${BASE}/public/vendor/register`,
      payload,
      { skipAuthHeader: true, skipAuthRefresh: true },
    );
  },

  /**
   * Vendor OTP-LAST self-registration. Browser submits the whole wizard +
   * a fresh Firebase ID token; backend creates the Keycloak user, the
   * catalog_vendors row (status=pending) and the vendor_signup_requests
   * audit row, and returns Keycloak tokens so the FE can land directly in
   * the dashboard.
   */
  registerVendorByPhone(payload: RegisterVendorByPhonePayload) {
    return apiClient.postInternal<LoginResponse>(
      `${BASE}/public/vendor/register-by-phone`,
      payload,
      { skipAuthHeader: true, skipAuthRefresh: true },
    );
  },

  refreshToken(refreshToken: string) {
    return apiClient.postInternal<LoginResponse>(
      `${BASE}/public/refresh`,
      { refreshToken },
      { skipAuthHeader: true, skipAuthRefresh: true },
    );
  },

  /** Revokes refresh token in Keycloak (best-effort). Caller still clears local storage + Firebase. */
  logout(refreshToken: string) {
    return apiClient.post<{ message?: string }>(`${BASE}/logout`, { refreshToken });
  },

};
