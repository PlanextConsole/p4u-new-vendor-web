/** Helpers for vendor business profile UI (categories, address, formatting). */

export function pickFirstCategoryLabel(categoriesJson: unknown): string {
  if (!Array.isArray(categoriesJson) || categoriesJson.length === 0) return "";
  const first = categoriesJson[0];
  if (typeof first === "string") return first.trim();
  if (first && typeof first === "object" && "name" in first) return String((first as { name?: string }).name || "").trim();
  return String(first).trim();
}

export function pickFirstServiceLabel(servicesJson: unknown): string {
  return pickFirstCategoryLabel(servicesJson);
}

export function shopAddressFromJson(addressJson: Record<string, unknown> | null | undefined): string {
  if (!addressJson || typeof addressJson !== "object") return "";
  const v =
    addressJson.areaLocality ??
    addressJson.shopAddress ??
    addressJson.line1 ??
    addressJson.addressLine1;
  return typeof v === "string" ? v.trim() : "";
}

export function latLngFromJson(addressJson: Record<string, unknown> | null | undefined): { lat: string; lng: string } {
  if (!addressJson || typeof addressJson !== "object") return { lat: "", lng: "" };
  const latRaw = addressJson.latitude ?? addressJson.lat;
  const lngRaw = addressJson.longitude ?? addressJson.lng;
  const lat = latRaw == null || latRaw === "" ? "" : String(latRaw);
  const lng = lngRaw == null || lngRaw === "" ? "" : String(lngRaw);
  return { lat, lng };
}

/** INR for dashboard stats (e.g. ₹27.6 or ₹1,234.5). */
export function formatInr(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/,/g, ""));
  if (Number.isNaN(n)) return "—";
  const s = n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${s}%`;
}
