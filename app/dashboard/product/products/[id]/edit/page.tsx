"use client";

import { VendorProductForm } from "@/components/vendor/products/VendorProductForm";

export default function EditVendorProductPage({ params }: { params: { id: string } }) {
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6">
      <VendorProductForm mode="edit" productId={params.id} />
    </div>
  );
}
