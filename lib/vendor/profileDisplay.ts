/** Helpers for vendor business profile UI (categories, address, formatting). */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when a string is a catalog/API id — must not be shown as user-facing label text. */
export function isUuidLike(value: string): boolean {
  return UUID_RE.test(String(value || "").trim());
}

export function pickFirstCategoryLabel(categoriesJson: unknown): string {
  if (!Array.isArray(categoriesJson) || categoriesJson.length === 0) return "";
  const first = categoriesJson[0];
  let label = "";
  if (typeof first === "string") label = first.trim();
  else if (first && typeof first === "object" && "name" in first) {
    label = String((first as { name?: string }).name || "").trim();
  } else label = String(first).trim();
  return isUuidLike(label) ? "" : label;
}

/** Legacy helper — never returns raw catalog service UUIDs. */
export function pickFirstServiceLabel(servicesJson: unknown): string {
  return pickFirstCategoryLabel(servicesJson);
}

/** Extract catalog service ids from vendor.servicesJson (strings or {id|serviceId} objects). */
export function serviceIdsFromJson(servicesJson: unknown): string[] {
  if (servicesJson == null) return [];
  if (Array.isArray(servicesJson)) {
    return servicesJson
      .map((entry) => {
        if (entry == null) return "";
        if (typeof entry === "string" || typeof entry === "number") return String(entry).trim();
        if (typeof entry === "object") {
          const o = entry as Record<string, unknown>;
          const id = o.id ?? o.serviceId ?? o.value;
          return id != null ? String(id).trim() : "";
        }
        return "";
      })
      .filter((id) => id.length > 0);
  }
  if (typeof servicesJson === "string") {
    try {
      return serviceIdsFromJson(JSON.parse(servicesJson));
    } catch {
      const s = servicesJson.trim();
      return s ? [s] : [];
    }
  }
  return [];
}

/** Human-readable service line for profile subtitle (comma-separated, max 2 names + overflow). */
export function formatServiceSubtitle(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter((n) => n && !isUuidLike(n));
  if (!clean.length) return "";
  if (clean.length <= 2) return clean.join(", ");
  return `${clean.slice(0, 2).join(", ")} +${clean.length - 2} more`;
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
