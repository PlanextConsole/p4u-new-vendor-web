"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, HelpCircle, Mail, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VendorFormLayout } from "@/components/vendor/VendorListUi";

export default function VendorHelpView() {
  const pathname = usePathname();
  const dashRoot = pathname.includes("/dashboard/service") ? "/dashboard/service" : "/dashboard/product";

  return (
    <VendorFormLayout width="md">
      <header className="flex items-center gap-3">
        <Link href={dashRoot} className="rounded-lg p-1 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-bold">Help &amp; Support</h1>
      </header>

      <Card className="p-6">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Need assistance?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Contact the P4U vendor support team for help with orders, settlements, KYC, or account issues.
            </p>
          </div>
        </div>
      </Card>

      <ul className="space-y-3">
        <li>
          <Card className="flex items-center gap-3 p-4">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Email support</p>
              <a href="mailto:support@p4u.in" className="text-sm text-primary underline">
                support@p4u.in
              </a>
            </div>
          </Card>
        </li>
        <li>
          <Card className="flex items-center gap-3 p-4">
            <MessageCircle className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Vendor handbook</p>
              <p className="text-sm text-muted-foreground">Guides for listings, payouts, and compliance are coming soon.</p>
            </div>
          </Card>
        </li>
      </ul>
    </VendorFormLayout>
  );
}
