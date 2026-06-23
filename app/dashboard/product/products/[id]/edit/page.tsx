"use client";

import { VendorProductForm } from "@/components/vendor/products/VendorProductForm";

export default function EditVendorProductPage({ params }: { params: { id: string } }) {
  return <VendorProductForm mode="edit" productId={params.id} />;
}
