/**
 * Admin / vendor uploads are often stored as path-only (`/uploads/...`, `/vendor-uploads/...`)
 * or as absolute dev URLs (`http://127.0.0.1:8082/uploads/...`). Resolve through the API gateway
 * so images load in production browsers.
 */

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "http://localhost:8080";

function gatewayOrigin(): string {
  try {
    return new URL(GATEWAY).origin;
  } catch {
    return "http://localhost:8080";
  }
}

function assetOrigin(): string {
  const m = process.env.NEXT_PUBLIC_MEDIA_ORIGIN?.trim();
  if (m) return m.replace(/\/$/, "");
  return gatewayOrigin();
}

export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (url == null || typeof url !== "string") return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith("//")) return `https:${u}`;
  if (u.startsWith("/uploads") || u.startsWith("/vendor-uploads") || u.startsWith("/socio-uploads")) {
    return `${assetOrigin()}${u}`;
  }
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      if (
        parsed.pathname.startsWith("/uploads") ||
        parsed.pathname.startsWith("/vendor-uploads") ||
        parsed.pathname.startsWith("/socio-uploads")
      ) {
        return `${assetOrigin()}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      return u;
    }
  }
  return u;
}
