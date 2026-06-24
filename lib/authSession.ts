import { resetRefreshSessionState } from "@/lib/api/client";
import { authApi, type LoginResponse } from "@/lib/api/auth";
import { VENDOR_AUTH, VENDOR_TOKEN_EVENT, clearVendorAuthStorage } from "@/lib/storageKeys";
import { signOutVendorFirebase } from "@/lib/firebase";

type AuthPayload = LoginResponse & {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  vendor_type?: string;
};

function normalizeAuthTokens(res: AuthPayload) {
  const accessToken = res.accessToken ?? res.access_token;
  const refreshToken = res.refreshToken ?? res.refresh_token;
  const expiresIn = res.expiresIn ?? res.expires_in;
  if (!accessToken || !refreshToken) {
    throw new Error("Login response did not include access and refresh tokens.");
  }
  return { accessToken, refreshToken, expiresIn: expiresIn ?? 300 };
}

export function dashboardPathForVendorType(vendorType?: string | null): string {
  return String(vendorType || "").toUpperCase() === "SERVICE"
    ? "/dashboard/service"
    : "/dashboard/product";
}

export function persistAuthSession(res: LoginResponse, username: string, vendorType?: string | null) {
  if (typeof window === "undefined") return;
  const { accessToken, refreshToken, expiresIn } = normalizeAuthTokens(res as AuthPayload);
  resetRefreshSessionState();
  localStorage.setItem(VENDOR_AUTH.access, accessToken);
  localStorage.setItem(VENDOR_AUTH.refresh, refreshToken);
  localStorage.setItem(VENDOR_AUTH.expiresIn, String(expiresIn));
  localStorage.setItem(VENDOR_AUTH.username, username);
  const vt =
    vendorType ??
    (res as AuthPayload).vendor_type ??
    localStorage.getItem(VENDOR_AUTH.vendorType);
  if (vt) localStorage.setItem(VENDOR_AUTH.vendorType, String(vt).toUpperCase());
  window.dispatchEvent(new CustomEvent(VENDOR_TOKEN_EVENT));
}

export function clearAuthSession() {
  clearVendorAuthStorage();
}

export function getStoredVendorType(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(VENDOR_AUTH.vendorType);
}

export function hasValidAccessToken(): boolean {
  if (typeof window === "undefined") return false;
  const access = localStorage.getItem(VENDOR_AUTH.access);
  if (!access) return false;
  try {
    const part = access.split(".")[1];
    if (!part) return false;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    // NOTE: do NOT clear the session here. An expired access token does not mean
    // the session is over — the refresh token usually still mints a new one. The
    // API client / session provider refresh on demand; tearing down storage here
    // would log the vendor out just for leaving a tab idle past the ~5 min token.
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * True when the vendor still has a usable session — i.e. a non-expired access
 * token OR a refresh token that can mint one. Route guards should use this (not
 * `hasValidAccessToken`) so an idle-expired access token doesn't bounce the
 * vendor to login when their refresh token is still good.
 */
export function hasVendorSession(): boolean {
  if (typeof window === "undefined") return false;
  if (hasValidAccessToken()) return true;
  return Boolean(localStorage.getItem(VENDOR_AUTH.refresh));
}

/**
 * Full vendor sign-out: revoke Keycloak refresh (when possible), clear stored
 * tokens, and sign out Firebase Phone Auth so the login screen starts clean.
 */
export async function signOutVendorCompletely(): Promise<void> {
  if (typeof window === "undefined") return;
  const refresh = localStorage.getItem(VENDOR_AUTH.refresh);
  const access = localStorage.getItem(VENDOR_AUTH.access);
  if (refresh && access) {
    try {
      await authApi.logout(refresh);
    } catch {
      // Expired access JWT or network — still clear browser state.
    }
  }
  clearAuthSession();
  await signOutVendorFirebase();
}

export function getStoredUsername(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(VENDOR_AUTH.username);
}

export function hasAccessToken(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(VENDOR_AUTH.access));
}
