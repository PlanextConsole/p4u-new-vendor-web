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

export interface VendorPlanOption {
  id: string;
  planName: string;
  planType: string;
  tier: number;
  price: string;
  commissionPercent: string;
  maxUserRedemptionPercent: string;
  radiusKm: string | null;
}

export type PlanCheckoutResponse =
  | { free: true; plan: VendorPlanOption }
  | {
      free: false;
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      plan: VendorPlanOption;
    };

export interface PlanVerifyPayload {
  planId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const vendorPlanApi = {
  get() {
    return apiClient.get<VendorPlanInfoDto>(`${BASE}/me/plan`);
  },

  listPlans() {
    return apiClient.get<{ items: VendorPlanOption[] }>(`${BASE}/me/plans`);
  },

  checkout(planId: string) {
    return apiClient.post<PlanCheckoutResponse>(`${BASE}/me/plan/checkout`, { planId });
  },

  verify(payload: PlanVerifyPayload) {
    return apiClient.post<{ verified: boolean; planInfo?: VendorPlanInfoDto }>(
      `${BASE}/me/plan/verify`,
      payload,
    );
  },
};
