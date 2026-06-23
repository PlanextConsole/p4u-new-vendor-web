/**
 * HTTP client for the P4U API Gateway (same as customer web; separate token keys).
 *
 * If `NEXT_PUBLIC_API_GATEWAY_URL` is unset, requests use same-origin `/api/...` and
 * `next.config.js` rewrites proxy to the gateway (avoids CORS / mixed-origin issues).
 */
import { VENDOR_AUTH, VENDOR_TOKEN_EVENT, clearVendorAuthStorage } from "@/lib/storageKeys";

/** Empty string = same-origin `/api` (see rewrites in next.config.js). */
const BASE_URL = (process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "").replace(/\/$/, "");

export interface ApiErrorShape {
  status: number;
  message: string;
  details?: unknown;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorEnvelope {
  success: false;
  error?: { code?: string; message?: string; details?: unknown };
}

interface RequestInternalOptions {
  skipAuthHeader?: boolean;
  skipAuthRefresh?: boolean;
  retry401?: boolean;
}

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem(VENDOR_AUTH.access);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

let refreshInFlight: Promise<void> | null = null;
/** After any failed refresh, block further attempts until the user logs in again. */
let refreshSessionDead = false;
/** Pause refresh after rate-limit to avoid hammering the server. */
let refreshBlockedUntil = 0;

/** Call after a successful login so background refresh can run again. */
export function resetRefreshSessionState() {
  refreshSessionDead = false;
  refreshBlockedUntil = 0;
  refreshInFlight = null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function apiTargetIsProduction(): boolean {
  if (/planext4u\.com/i.test(BASE_URL)) return true;
  if (typeof window !== "undefined") {
    return /planext4u\.com/i.test(window.location.hostname);
  }
  return false;
}

/** Dev Keycloak tokens cannot be refreshed against production API. */
function refreshTokenEnvMismatch(refresh: string): boolean {
  const payload = decodeJwtPayload(refresh);
  const iss = typeof payload?.iss === "string" ? payload.iss : "";
  const tokenIsLocal = /localhost|127\.0\.0\.1/i.test(iss);
  return apiTargetIsProduction() && tokenIsLocal;
}

function forceLoginRedirect() {
  refreshSessionDead = true;
  refreshBlockedUntil = Date.now() + 300_000;
  clearVendorAuthStorage();
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    const onAuthScreen = path === "/login" || path === "/" || path === "/register";
    if (!onAuthScreen) {
      window.location.assign("/");
    }
  }
}

function tokenSnapshot() {
  if (typeof window === "undefined")
    return { access: null as string | null, refresh: null as string | null };
  return {
    access: localStorage.getItem(VENDOR_AUTH.access),
    refresh: localStorage.getItem(VENDOR_AUTH.refresh),
  };
}

function broadcastTokenUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VENDOR_TOKEN_EVENT));
  }
}

function extractHttpErrorMessage(
  status: number,
  statusText: string,
  parsed: unknown,
  rawText: string,
): string {
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    const errObj = o.error;
    if (errObj && typeof errObj === "object" && "message" in errObj) {
      const m = (errObj as { message?: string }).message;
      if (typeof m === "string" && m.trim()) return m.trim();
    }
  }
  const flat = rawText.replace(/\s+/g, " ").trim();
  if (/network response was not ok/i.test(flat)) {
    return "API request failed before reaching auth service. Confirm API gateway is running on :8080 and restart `npm run dev` so Next.js /api rewrite is active.";
  }
  if (flat && !flat.startsWith("<") && flat.length < 400) return flat.slice(0, 300);
  return `Request failed (HTTP ${status}${statusText ? ` ${statusText}` : ""}). Check that the API gateway is running${BASE_URL ? ` at ${BASE_URL}` : " (proxied via /api)"}.`;
}

async function refreshAccessToken(): Promise<void> {
  if (refreshSessionDead) {
    throw { status: 401, message: "Session expired" } satisfies ApiErrorShape;
  }
  if (Date.now() < refreshBlockedUntil) {
    throw { status: 429, message: "Refresh paused. Please sign in again." } satisfies ApiErrorShape;
  }
  const { refresh } = tokenSnapshot();
  if (!refresh) {
    forceLoginRedirect();
    throw { status: 401, message: "No refresh token" } satisfies ApiErrorShape;
  }
  if (refreshTokenEnvMismatch(refresh)) {
    forceLoginRedirect();
    throw {
      status: 401,
      message: "Session was created on local dev and cannot be used on production. Please sign in again.",
    } satisfies ApiErrorShape;
  }
  const url = `${BASE_URL}/api/auth/public/refresh`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  const rawText = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.message != null ? String(data.message) : extractHttpErrorMessage(res.status, res.statusText, data, rawText);
    refreshSessionDead = true;
    if (res.status === 429) {
      refreshBlockedUntil = Date.now() + 300_000;
    }
    forceLoginRedirect();
    const err: ApiErrorShape = {
      status: res.status,
      message: typeof msg === "string" && msg.trim() ? msg : "Refresh failed",
      details: data ?? rawText,
    };
    throw err;
  }
  refreshSessionDead = false;
  refreshBlockedUntil = 0;
  const accessToken = data?.accessToken ?? data?.access_token;
  const refreshToken = data?.refreshToken ?? data?.refresh_token;
  const expiresIn = data?.expiresIn ?? data?.expires_in;
  if (!accessToken) throw new Error("Refresh response missing access token");
  if (typeof window !== "undefined") {
    localStorage.setItem(VENDOR_AUTH.access, String(accessToken));
    if (refreshToken) localStorage.setItem(VENDOR_AUTH.refresh, String(refreshToken));
    if (expiresIn != null) localStorage.setItem(VENDOR_AUTH.expiresIn, String(expiresIn));
  }
  broadcastTokenUpdate();
}

async function refreshAccessTokenDeduped(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  await refreshInFlight;
}

export async function ensureTokenFresh(): Promise<void> {
  const { access, refresh } = tokenSnapshot();
  if (!access || !refresh) return;
  if (refreshSessionDead || Date.now() < refreshBlockedUntil) return;
  const expMs = decodeJwtExpMs(access);
  /** Refresh a bit before expiry; wide window avoids hammering Keycloak on every request. */
  if (expMs != null && expMs - Date.now() > 300_000) return;
  await refreshAccessTokenDeduped();
}

function parseJsonBody(rawText: string, status: number): unknown {
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    throw {
      status,
      message:
        "Server returned non-JSON (proxy misconfigured or gateway down). Confirm the API gateway and Next.js /api rewrite.",
      details: rawText.slice(0, 240),
    } satisfies ApiErrorShape;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  internal: RequestInternalOptions = {},
): Promise<T> {
  const { skipAuthHeader = false, skipAuthRefresh = false, retry401 = false } = internal;
  const url = `${BASE_URL}${path}`;

  if (!skipAuthRefresh) {
    try {
      await ensureTokenFresh();
    } catch {
      if (!tokenSnapshot().access) {
        throw { status: 401, message: "Session expired" } satisfies ApiErrorShape;
      }
    }
  }

  if (!skipAuthHeader && !tokenSnapshot().access) {
    forceLoginRedirect();
    throw { status: 401, message: "Session expired" } satisfies ApiErrorShape;
  }

  const isFormData =
    typeof FormData !== "undefined" && options.body != null && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(skipAuthHeader ? {} : authHeaders()),
    ...(options.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const err: ApiErrorShape = {
      status: 0,
      message:
        msg === "Failed to fetch"
          ? "Cannot reach the API. Start the gateway on :8080, or leave NEXT_PUBLIC_API_GATEWAY_URL empty so /api is proxied by Next.js."
          : msg || "Network request failed",
      details: e,
    };
    throw err;
  }

  if (!res.ok) {
    const rawText = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      parsed = {};
    }
    if (res.status === 401 && !skipAuthRefresh && !retry401) {
      try {
        await refreshAccessTokenDeduped();
        return request<T>(path, options, { ...internal, retry401: true });
      } catch {
        forceLoginRedirect();
        throw {
          status: 401,
          message: "Session expired",
        } satisfies ApiErrorShape;
      }
    }
    const envelopeError =
      parsed && typeof parsed === "object" && "error" in parsed
        ? (parsed as unknown as ErrorEnvelope).error
        : undefined;
    const msg =
      envelopeError?.message ??
      (typeof (parsed as { message?: string })?.message === "string"
        ? (parsed as { message: string }).message
        : undefined) ??
      extractHttpErrorMessage(res.status, res.statusText, parsed, rawText);
    const err: ApiErrorShape = {
      status: res.status,
      message: msg,
      details: parsed,
    };
    throw err;
  }

  if (res.status === 204) return undefined as T;

  const rawText = await res.text();
  const body = parseJsonBody(rawText, res.status);

  if (body && typeof body === "object" && "success" in body) {
    const envelope = body as SuccessEnvelope<unknown> | ErrorEnvelope;
    if ((envelope as ErrorEnvelope).success === false) {
      const err: ApiErrorShape = {
        status: res.status,
        message: (envelope as ErrorEnvelope).error?.message ?? "Request failed",
        details: body,
      };
      throw err;
    }
    const ok = envelope as SuccessEnvelope<unknown>;
    return ok.data as T;
  }
  return body as T;
}

export const apiClient = {
  get<T>(path: string, params?: Record<string, string | number | boolean>) {
    const query = params
      ? "?" +
        new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      : "";
    return request<T>(path + query);
  },

  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "POST",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "PUT",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  /** POST multipart (do not set Content-Type manually; boundary is set by the browser). */
  postFormData<T>(path: string, formData: FormData) {
    return request<T>(path, { method: "POST", body: formData });
  },

  patch<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "PATCH",
      body: body != null ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string) {
    return request<T>(path, { method: "DELETE" });
  },

  postInternal<T>(path: string, body?: unknown, internal?: RequestInternalOptions) {
    return request<T>(
      path,
      {
        method: "POST",
        body: body != null ? JSON.stringify(body) : undefined,
      },
      internal,
    );
  },
};
