/** Local storage keys for this app (isolated from customer / admin UIs). */
export const VENDOR_AUTH = {
  access: "p4u_vendor_token",
  refresh: "p4u_vendor_refresh_token",
  expiresIn: "p4u_vendor_token_expires_in",
  username: "p4u_vendor_username",
} as const;

export const VENDOR_TOKEN_EVENT = "p4u-vendor-token-updated";
