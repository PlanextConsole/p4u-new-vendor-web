import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

export interface VendorDropshippingSettings {
  vendorId: string;
  enabled: boolean;
  defaultSupplierId: string | null;
  autoForwardOrders: boolean;
  defaultMarginPercent: number;
  notifyOnStatusChange: boolean;
  updatedAt?: string;
}

export interface DropshippingSettingsBundle {
  platformEnabled: boolean;
  settings: VendorDropshippingSettings;
}

export interface DropshippingSupplierRow {
  id: string;
  name: string;
  countryCode: string | null;
  currencyCode: string;
  defaultLeadTimeDays: number;
  defaultMarkupPercent: number;
}

export interface DropshippingOrderRow {
  id: string;
  orderId: string;
  vendorId: string;
  supplierId: string;
  supplierOrderRef: string | null;
  costTotal: string;
  marginAmount: string;
  currencyCode: string;
  status: string;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  createdAt?: string;
  forwardedAt?: string | null;
}

export interface DropshippingOrderListResponse {
  items: DropshippingOrderRow[];
  total: number;
  limit: number;
  offset: number;
}

export const vendorDropshippingApi = {
  getSettings() {
    return apiClient.get<DropshippingSettingsBundle>(`${BASE}/me/dropshipping/settings`);
  },

  saveSettings(body: Partial<{
    enabled: boolean;
    defaultSupplierId: string | null;
    autoForwardOrders: boolean;
    defaultMarginPercent: number;
    notifyOnStatusChange: boolean;
  }>) {
    return apiClient.put<DropshippingSettingsBundle>(`${BASE}/me/dropshipping/settings`, body);
  },

  listSuppliers() {
    return apiClient.get<{ items: DropshippingSupplierRow[] }>(`${BASE}/me/dropshipping/suppliers`);
  },

  listOrders(params?: { limit?: number; offset?: number }) {
    const q: Record<string, number> = {};
    if (params?.limit != null) q.limit = params.limit;
    if (params?.offset != null) q.offset = params.offset;
    return apiClient.get<DropshippingOrderListResponse>(`${BASE}/me/dropshipping/orders`, q);
  },

  createFromCommerceOrder(orderId: string) {
    return apiClient.post<DropshippingOrderRow>(
      `${BASE}/me/dropshipping/orders/from-commerce/${encodeURIComponent(orderId)}`,
    );
  },

  forwardOrder(dropshippingOrderId: string) {
    return apiClient.post<DropshippingOrderRow>(
      `${BASE}/me/dropshipping/orders/${encodeURIComponent(dropshippingOrderId)}/forward`,
    );
  },

  cancelOrder(dropshippingOrderId: string) {
    return apiClient.patch<DropshippingOrderRow>(
      `${BASE}/me/dropshipping/orders/${encodeURIComponent(dropshippingOrderId)}/status`,
      { status: 'cancelled' },
    );
  },
};
