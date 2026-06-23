"use client";

import { useEffect } from "react";
import { VENDOR_AUTH, VENDOR_TOKEN_EVENT } from "@/lib/storageKeys";
import { ensureTokenFresh } from "@/lib/api/client";

function decodeJwtExpMs(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Keeps vendor Keycloak tokens fresh across page loads and idle tabs. */
export default function VendorSessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const timerRef = { current: null as ReturnType<typeof setTimeout> | null };

    const scheduleRefresh = (): ReturnType<typeof setTimeout> | null => {
      const token = localStorage.getItem(VENDOR_AUTH.access);
      const refresh = localStorage.getItem(VENDOR_AUTH.refresh);
      if (!token || !refresh) return null;

      const exp = decodeJwtExpMs(token);
      const now = Date.now();
      let delayMs: number;
      if (exp != null) {
        delayMs = exp - now - 45_000;
        if (delayMs < 5_000) delayMs = Math.max(0, exp - now - 5_000);
        if (exp - now < 90_000) delayMs = 0;
      } else {
        const fallback = Number(localStorage.getItem(VENDOR_AUTH.expiresIn) || "300");
        delayMs = Math.max((fallback - 45) * 1000, 10_000);
      }

      return setTimeout(() => {
        void ensureTokenFresh();
        const next = scheduleRefresh();
        if (next) timerRef.current = next;
      }, delayMs);
    };

    const onTokenUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = scheduleRefresh();
    };

    // Restore + refresh the session as soon as the app mounts (F5, reopen, new tab).
    void ensureTokenFresh();
    onTokenUpdate();
    window.addEventListener(VENDOR_TOKEN_EVENT, onTokenUpdate);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener(VENDOR_TOKEN_EVENT, onTokenUpdate);
    };
  }, []);

  return <>{children}</>;
}
