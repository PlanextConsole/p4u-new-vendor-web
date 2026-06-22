import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

export interface VendorSettlementRow {
  id: string;
  vendorId: string | null;
  orderId: string | null;
  settlementType: string;
  status: string;
  amount: string;
  metadata: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorSettlementListResponse {
  items: VendorSettlementRow[];
  total: number;
  limit: number;
  offset: number;
}

export const vendorSettlementsApi = {
  list(params?: { q?: string; status?: string; from?: string; to?: string; limit?: number; offset?: number }) {
    const q: Record<string, string | number> = {};
    if (params?.q) q.q = params.q;
    if (params?.status) q.status = params.status;
    if (params?.from) q.from = params.from;
    if (params?.to) q.to = params.to;
    if (params?.limit != null) q.limit = params.limit;
    if (params?.offset != null) q.offset = params.offset;
    return apiClient.get<VendorSettlementListResponse>(`${BASE}/me/settlements`, q);
  },

  get(settlementId: string) {
    return apiClient.get<VendorSettlementRow>(`${BASE}/me/settlements/${encodeURIComponent(settlementId)}`);
  },
};
