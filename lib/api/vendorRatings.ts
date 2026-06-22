import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

export interface VendorRatingSummary {
  averageRating: number;
  reviewCount: number;
  distribution: Record<string, number>;
}

export const vendorRatingsApi = {
  getSummary() {
    return apiClient.get<VendorRatingSummary>(`${BASE}/me/rating-summary`);
  },
};
