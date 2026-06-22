import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

/** Response from `GET /api/v1/vendor/me/plan` (vendor-management-service). */
export interface VendorPlanInfoDto {
  vendor: Record<string, unknown>;
  plan: {
    id: string;
    planName: string;
    planType: string;
    tier: number;
    price: string;
    commissionPercent: string;
    maxUserRedemptionPercent: string;
    radiusKm: string | null;
  } | null;
  effective: {
    commissionPercent: string;
    maxRedemptionPercent: string;
  };
}

export const vendorPlanApi = {
  get() {
    return apiClient.get<VendorPlanInfoDto>(`${BASE}/me/plan`);
  },
};
