import { resetRefreshSessionState } from "@/lib/api/client";
import { authApi, type LoginResponse } from "@/lib/api/auth";
import { VENDOR_AUTH, VENDOR_TOKEN_EVENT, clearVendorAuthStorage } from "@/lib/storageKeys";
import { signOutVendorFirebase } from "@/lib/firebase";
export function persistAuthSession(res: LoginResponse, username: string) {
  if (typeof window === "undefined") return;
  resetRefreshSessionState();
  localStorage.setItem(VENDOR_AUTH.access, res.accessToken);
  localStorage.setItem(VENDOR_AUTH.refresh, res.refreshToken);
  localStorage.setItem(VENDOR_AUTH.expiresIn, String(res.expiresIn));
  localStorage.setItem(VENDOR_AUTH.username, username);
  window.dispatchEvent(new CustomEvent(VENDOR_TOKEN_EVENT));
}

export function clearAuthSession() {
  clearVendorAuthStorage();
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
