"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getStoredVendorType } from "@/lib/authSession";
import { getVendorMe } from "@/lib/api/vendor";

export function isServiceVendorType(vendorType?: string | null): boolean {
  return String(vendorType || "").toUpperCase() === "SERVICE";
}

function vendorTypeFromPath(pathname: string): boolean | null {
  if (pathname.includes("/dashboard/service")) return true;
  if (pathname.includes("/dashboard/product")) return false;
  return null;
}

/** True = service vendor (bookings + settlements). False = product vendor (orders/settlements only). */
export function useIsServiceVendor(): boolean {
  const pathname = usePathname();
  const [isService, setIsService] = useState(() => {
    const fromPath = vendorTypeFromPath(pathname);
    if (fromPath !== null) return fromPath;
    return isServiceVendorType(getStoredVendorType());
  });

  useEffect(() => {
    const fromPath = vendorTypeFromPath(pathname);
    if (fromPath !== null) setIsService(fromPath);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getVendorMe();
        if (!cancelled) setIsService(isServiceVendorType(me.vendorType));
      } catch {
        /* keep path / stored hint */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isService;
}
