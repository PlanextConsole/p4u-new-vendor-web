import type { VendorSettlementRow } from "@/lib/api/vendorSettlements";
import { vendorSettlementsApi } from "@/lib/api/vendorSettlements";
import { vendorBookingsApi } from "@/lib/api/vendorBookings";
import { completedBookingsAsPendingSettlements } from "./settlementDisplay";

export type SettlementListParams = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

/** Product vendors: commerce settlements only. Service vendors: settlements + completed bookings not yet settled. */
export async function fetchVendorSettlementRows(
  isService: boolean,
  listParams: SettlementListParams = {},
): Promise<{ settlements: VendorSettlementRow[]; bookingSettlements: VendorSettlementRow[] }> {
  const settlementsRes = await vendorSettlementsApi.list({ limit: 500, offset: 0, ...listParams });
  const settlements = settlementsRes.items || [];

  if (!isService) {
    return { settlements, bookingSettlements: [] };
  }

  try {
    const completedBookingsRes = await vendorBookingsApi.list({ status: "completed", limit: 500, offset: 0 });
    const bookingSettlements = completedBookingsAsPendingSettlements(
      completedBookingsRes.items || [],
      settlements,
    );
    return { settlements, bookingSettlements };
  } catch {
    return { settlements, bookingSettlements: [] };
  }
}

export function mergeSettlementRows(
  settlements: VendorSettlementRow[],
  bookingSettlements: VendorSettlementRow[],
  options?: { statusFilter?: string },
): VendorSettlementRow[] {
  const statusFilter = options?.statusFilter?.trim();
  const merged = [...settlements, ...bookingSettlements];
  if (!statusFilter) return merged;
  return merged.filter((row) => row.status.toLowerCase() === statusFilter.toLowerCase());
}
