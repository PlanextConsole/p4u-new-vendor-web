import { apiClient } from "./client";

const BASE = "/api/v1/commerce";

/** Row from `commerce_bookings` (vendor-scoped list). */
export interface VendorBookingRow {
  id: string;
  customerId: string;
  vendorId: string;
  serviceId: string | null;
  bookingDate: string;
  timeSlot: string;
  status: string;
  addressId?: string | null;
  notes?: string | null;
  totalAmount?: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorBookingListResponse {
  items: VendorBookingRow[];
  total: number;
  limit: number;
  offset: number;
}

export const vendorBookingsApi = {
  list(params?: { status?: string; limit?: number; offset?: number }) {
    const q: Record<string, string | number> = {};
    if (params?.status) q.status = params.status;
    if (params?.limit != null) q.limit = params.limit;
    if (params?.offset != null) q.offset = params.offset;
    return apiClient.get<VendorBookingListResponse>(`${BASE}/bookings/vendor`, q);
  },

  updateStatus(bookingId: string, status: "approved" | "rejected") {
    return apiClient.patch<VendorBookingRow>(
      `${BASE}/bookings/${encodeURIComponent(bookingId)}/status`,
      { status },
    );
  },
};
