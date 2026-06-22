"use client";

import { VendorProductForm } from "@/components/vendor/products/VendorProductForm";

export default function NewVendorProductPage() {
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6">
      <p className="text-sm leading-relaxed text-slate-600">
        Same fields as admin product create (categories, tax, pricing, attributes, SEO). Your vendor is set automatically.
      </p>
      <VendorProductForm mode="create" />
    </div>
  );
}
