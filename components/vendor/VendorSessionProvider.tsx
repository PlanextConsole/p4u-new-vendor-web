"use client";

import { useEffect } from "react";
import { ensureTokenFresh } from "@/lib/api/client";
import { VENDOR_AUTH, VENDOR_TOKEN_EVENT } from "@/lib/storageKeys";

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

function hasStoredSession(): boolean {
  return Boolean(
    localStorage.getItem(VENDOR_AUTH.access) || localStorage.getItem(VENDOR_AUTH.refresh),
  );
}

function nextRefreshDelayMs(): number {
  const token = localStorage.getItem(VENDOR_AUTH.access);
  if (!token) return 60_000;
  const exp = decodeJwtExpMs(token);
  const now = Date.now();
  if (exp != null) {
    let delayMs = exp - now - 45_000;
    if (delayMs < 5_000) delayMs = Math.max(5_000, exp - now - 5_000);
    if (exp - now < 90_000) delayMs = Math.max(30_000, exp - now - 5_000);
    return delayMs;
  }
  const fallback = Number(localStorage.getItem(VENDOR_AUTH.expiresIn) || "300");
  return Math.max((fallback - 45) * 1000, 30_000);
}

/** Keeps vendor Keycloak tokens fresh across page loads and idle tabs. */
export default function VendorSessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const runRefresh = async () => {
      if (cancelled || !hasStoredSession()) return;

      let nextDelay = nextRefreshDelayMs();
      try {
        await ensureTokenFresh();
      } catch {
        if (!hasStoredSession()) return;
        nextDelay = Math.max(nextDelay, 120_000);
      }

      if (cancelled || !hasStoredSession()) return;
      timeoutId = setTimeout(() => {
        void runRefresh();
      }, nextDelay);
    };

    const restart = () => {
      if (timeoutId != null) clearTimeout(timeoutId);
      if (!hasStoredSession()) return;
      void runRefresh();
    };

    restart();
    window.addEventListener(VENDOR_TOKEN_EVENT, restart);
    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
      window.removeEventListener(VENDOR_TOKEN_EVENT, restart);
    };
  }, []);

  return <>{children}</>;
}

