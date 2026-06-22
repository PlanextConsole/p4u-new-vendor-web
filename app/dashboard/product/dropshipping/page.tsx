"use client";

import { Truck } from "lucide-react";

export default function ProductDropshippingPage() {
  return (
    <div className="mx-auto min-w-0 max-w-2xl rounded-[14px] border border-slate-100 bg-white p-8 shadow-[0_2px_12px_rgba(15,23,42,0.06)] sm:p-10">
      <div className="flex items-center gap-3 text-slate-900">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#20a090]/10">
          <Truck className="h-6 w-6 text-[#20a090]" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Fulfilment partners</p>
          <p className="text-sm text-slate-500">Product vendor · dropshipping</p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        Connect dropship suppliers and sync inventory here. This section is ready for your
        vendor-management APIs (catalog, fulfilment status, and partner payouts).
      </p>
    </div>
  );
}
