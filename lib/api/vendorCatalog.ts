import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

export interface MergedCategory {
  id: string;
  name: string;
  parentId: string | null;
}

export interface TaxConfigurationRow {
  id: string;
  code: string;
  title: string;
  percentage: string;
  isActive?: boolean;
}

export interface ProductAttributeRow {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  selectValues: unknown;
}

export interface CatalogProductRow {
  id: string;
  name: string;
  availability: boolean;
  vendorId: string | null;
  categoryId: string | null;
  sellPrice: string;
  discountAmount: string;
  finalPrice: string;
  taxConfigurationId: string | null;
  /** Same top-level columns as admin `CreateProductDto` / `catalog_products`. */
  durationHours?: number | null;
  durationMinutes?: number | null;
  shortDescription: string | null;
  longDescription: string | null;
  promiseP4u?: string | null;
  helpLineNumber?: string | null;
  thumbnailUrl: string | null;
  bannerUrls?: string[] | null;
  commissionOverridePercent: string | null;
  description?: string | null;
  isActive: boolean;
  /** `pending` until admin approves; legacy rows may be null (treated as approved by API). */
  moderationStatus?: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  /** Units sold (from completed orders); present on list responses. */
  unitsSold?: number;
  variations?: ProductVariationRow[];
}

export interface ProductVariationRow {
  id: string;
  productId?: string;
  sku?: string | null;
  attributes: Record<string, string>;
  sellPrice: string;
  discountAmount?: string;
  finalPrice: string;
  quantity: number;
  thumbnailUrl?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown> | null;
}

export interface ProductListResponse {
  items: CatalogProductRow[];
  total: number;
  limit: number;
  offset: number;
}

/** Same payload shape as admin `createProduct` / `updateProduct` (vendorId forced server-side). */
export type VendorProductUpsertBody = Record<string, unknown>;

export const vendorCatalogApi = {
  listCategoriesForProducts() {
    return apiClient.get<{ items: MergedCategory[] }>(`${BASE}/me/catalog/categories-for-products`);
  },
  listTaxConfigurations() {
    return apiClient.get<{ items: TaxConfigurationRow[] }>(`${BASE}/me/catalog/tax-configurations`);
  },
  listProductAttributes() {
    return apiClient.get<{ items: ProductAttributeRow[] }>(`${BASE}/me/catalog/product-attributes`);
  },
  listProducts(params?: {
    q?: string;
    status?: string;
    moderation?: "pending" | "approved" | "all";
    limit?: number;
    offset?: number;
  }) {
    const q: Record<string, string | number> = {};
    if (params?.q) q.q = params.q;
    if (params?.status) q.status = params.status;
    if (params?.moderation) q.moderation = params.moderation;
    if (params?.limit != null) q.limit = params.limit;
    if (params?.offset != null) q.offset = params.offset;
    return apiClient.get<ProductListResponse>(`${BASE}/me/products`, q);
  },
  getProduct(id: string) {
    return apiClient.get<CatalogProductRow>(`${BASE}/me/products/${encodeURIComponent(id)}`);
  },
  createProduct(body: VendorProductUpsertBody) {
    return apiClient.post<CatalogProductRow>(`${BASE}/me/products`, body);
  },
  patchProduct(id: string, body: VendorProductUpsertBody) {
    return apiClient.patch<CatalogProductRow>(`${BASE}/me/products/${encodeURIComponent(id)}`, body);
  },
  deleteProduct(id: string) {
    return apiClient.delete<{ ok: boolean }>(`${BASE}/me/products/${encodeURIComponent(id)}`);
  },
};
