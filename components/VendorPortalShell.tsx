"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CalendarClock,
  Clock3,
  CreditCard,
  DollarSign,
  History,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Wrench,
} from "lucide-react";
import { getStoredUsername, hasAccessToken, signOutVendorCompletely } from "@/lib/authSession";
import { getVendorMe, type VendorProfile } from "@/lib/api/vendor";
import type { ApiErrorShape } from "@/lib/api/client";

export default function VendorPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<VendorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!hasAccessToken()) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await getVendorMe();
        if (cancelled) return;
        setMe(profile);
      } catch (err) {
        if (cancelled) return;
        const status =
          typeof err === "object" && err !== null && "status" in err
            ? (err as ApiErrorShape).status
            : -1;
        if (status === 401 || status === 403) {
          router.replace("/");
          return;
        }
        router.replace("/onboarding");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!me) return;
    const vt = String(me.vendorType || "").toUpperCase();
    if (vt === "SERVICE" && pathname.startsWith("/dashboard/product")) {
      router.replace("/dashboard/service");
      return;
    }
    if (vt === "PRODUCT" && pathname.startsWith("/dashboard/service")) {
      router.replace("/dashboard/product");
    }
  }, [pathname, me, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const vendorType = String(me?.vendorType || "").toUpperCase();
  const isService = vendorType === "SERVICE";

  async function logout() {
    await signOutVendorCompletely();
    router.replace("/");
  }

  const displayName = getStoredUsername() || me?.ownerName || me?.businessName || "Vendor";

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-red-700">{error}</p>
        <Link href="/" className="text-vendor-teal underline">
          Back to login
        </Link>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Loading vendor portal…
      </div>
    );
  }

  // Keep the verification banner up until admin actually flips status to
  // `active`. Soft onboarding rows are always pending; catalog rows are
  // pending until approved (status="active"). "rejected" gets a distinct
  // red banner so the vendor knows admin pushed back.
  const status = String(me.status || "").toLowerCase();
  const isApproved = status === "active";
  const isRejected = status === "rejected";
  const showPendingBanner = !isApproved && !isRejected;

  const serviceLinks = [
    { href: "/dashboard/service", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/service/services", label: "Services", icon: Wrench },
    { href: "/dashboard/service/availability", label: "Availability", icon: CalendarClock },
    { href: "/dashboard/service/bookings", label: "Bookings", icon: CalendarCheck },
    { href: "/dashboard/service/settlements", label: "Settlements", icon: DollarSign },
    { href: "/dashboard/service/payments", label: "Payment History", icon: History },
    { href: "/dashboard/service/bank", label: "Bank Account", icon: CreditCard },
    { href: "/dashboard/service/profile", label: "Profile & Settings", icon: Settings },
    { href: "/dashboard/service/media", label: "Media Library", icon: ImageIcon },
    { href: "/dashboard/service/kyc", label: "KYC Verification", icon: ShieldCheck },
  ];

  const productLinks = [
    { href: "/dashboard/product", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/product/products", label: "Products", icon: Package },
    { href: "/dashboard/product/orders", label: "Orders", icon: ShoppingCart },
    { href: "/dashboard/product/settlements", label: "Settlements", icon: DollarSign },
    { href: "/dashboard/product/payments", label: "Payment History", icon: History },
    { href: "/dashboard/product/bank", label: "Bank Account", icon: CreditCard },
    { href: "/dashboard/product/profile", label: "Profile & Settings", icon: Settings },
    { href: "/dashboard/product/media", label: "Media Library", icon: ImageIcon },
    { href: "/dashboard/product/kyc", label: "KYC Verification", icon: ShieldCheck },
  ];

  const links = isService ? serviceLinks : productLinks;

  return (
    <div className="relative flex min-h-screen min-w-0 bg-white">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-[1px] transition-opacity lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-[280px] shrink-0 flex-col border-r border-white/[0.12] bg-[#149a9a] text-[#eaf6f6] shadow-xl transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 border-b border-white/10 bg-black/[0.06] px-5 py-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 shadow-sm ring-1 ring-white/20">
            <Image src="/logo.png" alt="P4U" width={40} height={40} className="h-10 w-10 object-contain" priority />
          </div>
          <div className="min-w-0">
            <p className="text-[1.375rem] font-bold leading-tight tracking-tight text-white">Vendor Portal</p>
            <p className="mt-0.5 truncate text-sm leading-snug text-white/90">
              {me.businessName || (isService ? "Service vendor" : "Product vendor")}
            </p>
          </div>
        </div>
        <nav
          className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-3 pb-5 pt-1 [scrollbar-color:rgba(255,255,255,0.35)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 hover:[&::-webkit-scrollbar-thumb]:bg-white/40"
          aria-label="Main navigation"
        >
          {links.map(({ href, label, icon: Icon }) => {
            const active = isVendorNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={
                  active
                    ? "flex items-center gap-3 rounded-lg border border-transparent bg-[#128c8c] px-3 py-2.5 text-sm font-semibold leading-snug text-white shadow-[inset_3px_0_0_#1ccad8] transition-colors duration-150 hover:bg-[#128c8c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                    : "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium leading-snug text-[#eaf6f6] transition-colors duration-150 hover:bg-[#138f8f] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                }
                onClick={() => setMobileNavOpen(false)}
              >
                <Icon
                  className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-[#eaf6f6] group-hover:text-white"}`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-left">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-w-0">
        <header className="flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center sm:gap-3 sm:pr-2">
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-6 w-6" aria-hidden />
            </button>
            <h1 className="min-w-0 max-w-full flex-1 text-pretty text-2xl font-semibold leading-snug text-slate-900">
              {deriveHeaderTitle(pathname)}
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end sm:gap-4">
            <button type="button" className="rounded-full p-2 hover:bg-slate-100" aria-label="Notifications">
              <Bell className="h-5 w-5 text-slate-600" />
            </button>
            <div className="flex min-w-0 max-w-[220px] items-center gap-3 sm:max-w-[280px]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#149a9a] text-sm font-semibold text-white">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{me.businessName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Sign out
            </button>
          </div>
        </header>

        {showPendingBanner ? (
          <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6 lg:px-8">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">Profile pending verification</p>
              <p className="text-xs text-amber-800/80">
                Your application is with admin for review. You can keep using the dashboard;
                some actions will unlock once your profile is approved.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Edit application
            </Link>
          </div>
        ) : null}

        {isRejected ? (
          <div className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 sm:px-6 lg:px-8">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">Application not approved</p>
              <p className="text-xs text-red-800/80">
                Admin has rejected your application. Please update your details and re-submit
                for another review.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-900 hover:bg-red-100"
            >
              Update application
            </Link>
          </div>
        ) : null}

        <main className="flex-1 min-h-0 min-w-0 bg-[#f6f8f9] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full min-w-0 max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Product/Service "Dashboard" hrefs are prefixes of every other sidebar URL — match them only on the exact path. */
const VENDOR_DASHBOARD_ROOTS = new Set(["/dashboard/product", "/dashboard/service"]);

function isVendorNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path === href) return true;
  if (VENDOR_DASHBOARD_ROOTS.has(href)) return false;
  return path.startsWith(`${href}/`);
}

function deriveHeaderTitle(pathname: string): string {
  if (pathname.endsWith("/dashboard/service") || pathname.endsWith("/dashboard/product")) return "Dashboard";
  if (pathname.includes("/products/new")) return "Add product";
  if (/\/products\/[^/]+\/edit$/.test(pathname)) return "Edit product";
  const last = pathname.split("/").filter(Boolean).pop() || "Dashboard";
  const map: Record<string, string> = {
    services: "My Services",
    availability: "Availability",
    bookings: "Bookings",
    orders: "Orders",
    settlements: "Settlements",
    payments: "Payment History",
    bank: "Bank Accounts",
    profile: "Business Profile",
    media: "Media Library",
    kyc: "KYC Verification",
    products: "My Products",
    shipments: "Shipments",
  };
  return map[last] ?? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
