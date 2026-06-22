import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

export interface ServiceCategoryRow {
  id: string;
  name: string;
  slug?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CatalogServiceItemRow {
  id: string;
  serviceCategoryId?: string | null;
  name: string;
  availability?: boolean;
  trending?: boolean;
  iconUrl?: string | null;
  description?: string | null;
  basePrice?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface VendorServiceOfferingRow {
  id: string;
  vendorId: string;
  serviceId: string;
  price: string;
  isAvailable: boolean;
  isActive: boolean;
  moderationStatus?: string | null;
  metadata: Record<string, unknown> | null;
  catalogName: string;
  catalogIconUrl: string | null;
  catalogDescription: string | null;
  catalogMetadata: Record<string, unknown> | null;
  categoryId: string | null;
  categoryName: string | null;
}

export type PriceType = "fixed" | "starting_from" | "hourly";

export interface CreateVendorServiceOfferingBody {
  serviceId: string;
  price: string;
  isActive?: boolean;
  isAvailable?: boolean;
  displayName?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  trending?: boolean;
  emergency?: boolean;
  basePrice?: string | null;
  priceType?: PriceType | null;
  duration?: string | null;
  city?: string | null;
}

export type PatchVendorServiceOfferingBody = Partial<CreateVendorServiceOfferingBody>;

export const vendorOfferedServicesApi = {
  listServiceCategories() {
    return apiClient.get<{ items: ServiceCategoryRow[] }>(`${BASE}/me/catalog/service-categories`).then((r) => r.items);
  },
  listCatalogServiceItems() {
    return apiClient.get<{ items: CatalogServiceItemRow[] }>(`${BASE}/me/catalog/service-items`).then((r) => r.items);
  },
  listOfferings() {
    return apiClient.get<{ items: VendorServiceOfferingRow[] }>(`${BASE}/me/vendor-services`).then((r) => r.items);
  },
  create(body: CreateVendorServiceOfferingBody) {
    return apiClient.post<CatalogVendorServiceRow>(`${BASE}/me/vendor-services`, body);
  },
  patch(linkId: string, body: PatchVendorServiceOfferingBody) {
    return apiClient.patch<CatalogVendorServiceRow>(`${BASE}/me/vendor-services/${encodeURIComponent(linkId)}`, body);
  },
  delete(linkId: string) {
    return apiClient.delete<{ ok: boolean }>(`${BASE}/me/vendor-services/${encodeURIComponent(linkId)}`);
  },
};

/** Minimal row returned from POST/PATCH (link only). */
export interface CatalogVendorServiceRow {
  id: string;
  vendorId: string;
  serviceId: string;
  price: string;
  isAvailable: boolean;
  isActive: boolean;
  moderationStatus?: string | null;
  metadata: Record<string, unknown> | null;
}
