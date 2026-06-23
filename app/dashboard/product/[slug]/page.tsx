"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VendorFormLayout } from "@/components/vendor/VendorListUi";

export default function ProductSectionPage({ params }: { params: { slug: string } }) {
  const title = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <VendorFormLayout width="md">
      <header className="flex items-center gap-3">
        <Link href="/dashboard/product" className="rounded-lg p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">{title}</h1>
      </header>
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This section is not available yet. Use the sidebar to manage products, orders, and settlements.
        </p>
      </Card>
    </VendorFormLayout>
  );
}
