/**
 * Resolve gateway-served upload paths for img src / links.
 * Matches p4u-new-user-web/lib/media.ts semantics.
 */

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? "";

function gatewayOrigin(): string {
  if (!GATEWAY.trim()) return "";
  try {
    return new URL(GATEWAY).origin;
  } catch {
    return "";
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
  if (u.startsWith("data:") || u.startsWith("blob:")) return u;
  if (u.startsWith("/uploads") || u.startsWith("/vendor-uploads") || u.startsWith("/socio-uploads")) {
    const origin = assetOrigin();
    return origin ? `${origin}${u}` : u;
  }
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      if (
        parsed.pathname.startsWith("/uploads") ||
        parsed.pathname.startsWith("/vendor-uploads") ||
        parsed.pathname.startsWith("/socio-uploads")
      ) {
        const origin = assetOrigin();
        const path = `${parsed.pathname}${parsed.search}`;
        return origin ? `${origin}${path}` : path;
      }
    } catch {
      return u;
    }
    return u;
  }
  return u;
}
