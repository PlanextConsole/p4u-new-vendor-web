import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

export interface VendorCommerceOrder {
  id: string;
  vendorId: string | null;
  customerId: string | null;
  orderRef: string | null;
  status: string;
  totalAmount: string;
  metadata: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorOrderListResponse {
  items: VendorCommerceOrder[];
  total: number;
  limit: number;
  offset: number;
}

export const vendorOrdersApi = {
  list(params?: { status?: string; limit?: number; offset?: number }) {
    const q: Record<string, string | number> = {};
    if (params?.status) q.status = params.status;
    if (params?.limit != null) q.limit = params.limit;
    if (params?.offset != null) q.offset = params.offset;
    return apiClient.get<VendorOrderListResponse>(`${BASE}/orders`, q);
  },

  get(orderId: string) {
    return apiClient.get<VendorCommerceOrder>(
      `${BASE}/orders/${encodeURIComponent(orderId)}`,
    );
  },

  patch(orderId: string, body: { status?: string; metadata?: Record<string, unknown> | null }) {
    return apiClient.patch<VendorCommerceOrder>(
      `${BASE}/orders/${encodeURIComponent(orderId)}`,
      body,
    );
  },
};
