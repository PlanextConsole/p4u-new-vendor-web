/** Local storage keys for this app (isolated from customer / admin UIs). */
export const VENDOR_AUTH = {
  access: "p4u_vendor_token",
  refresh: "p4u_vendor_refresh_token",
  expiresIn: "p4u_vendor_token_expires_in",
  username: "p4u_vendor_username",
} as const;

export const VENDOR_TOKEN_EVENT = "p4u-vendor-token-updated";

/** Clear stored vendor tokens without calling logout API (safe from api client). */
export function clearVendorAuthStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(VENDOR_AUTH.access);
  localStorage.removeItem(VENDOR_AUTH.refresh);
  localStorage.removeItem(VENDOR_AUTH.expiresIn);
  localStorage.removeItem(VENDOR_AUTH.username);
  window.dispatchEvent(new CustomEvent(VENDOR_TOKEN_EVENT));
}
