"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  Store,
  Truck,
  User,
  Wrench,
  X,
} from "lucide-react";
import { getStoredUsername, hasAccessToken, signOutVendorCompletely } from "@/lib/authSession";
import { getVendorMe, type VendorProfile } from "@/lib/api/vendor";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

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
      } catch {
        if (!cancelled) router.replace("/onboarding");
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
  const displayName = getStoredUsername() || me?.ownerName || me?.businessName || "Vendor";
  const vendorInitial = displayName.trim().charAt(0).toUpperCase() || "V";

  const serviceLinks: NavLink[] = [
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

  const productLinks: NavLink[] = [
    { href: "/dashboard/product", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/product/products", label: "Products", icon: Package },
    { href: "/dashboard/product/orders", label: "Orders", icon: ShoppingCart },
    { href: "/dashboard/product/dropshipping", label: "Dropshipping", icon: Truck },
    { href: "/dashboard/product/settlements", label: "Settlements", icon: DollarSign },
    { href: "/dashboard/product/payments", label: "Payment History", icon: History },
    { href: "/dashboard/product/bank", label: "Bank Account", icon: CreditCard },
    { href: "/dashboard/product/profile", label: "Profile & Settings", icon: Settings },
    { href: "/dashboard/product/media", label: "Media Library", icon: ImageIcon },
    { href: "/dashboard/product/kyc", label: "KYC Verification", icon: ShieldCheck },
  ];

  const links = isService ? serviceLinks : productLinks;
  const dashRoot = isService ? "/dashboard/service" : "/dashboard/product";

  const mobileBottomNav = useMemo((): NavLink[] => {
    if (isService) {
      return [
        { href: dashRoot, label: "Home", icon: LayoutDashboard },
        { href: "/dashboard/service/services", label: "Services", icon: Wrench },
        { href: "/dashboard/service/bookings", label: "Bookings", icon: ShoppingCart },
        { href: "/dashboard/service/settlements", label: "Payments", icon: DollarSign },
        { href: "/dashboard/service/profile", label: "Profile", icon: User },
      ];
    }
    return [
      { href: dashRoot, label: "Home", icon: LayoutDashboard },
      { href: "/dashboard/product/products", label: "Products", icon: Package },
      { href: "/dashboard/product/orders", label: "Orders", icon: ShoppingCart },
      { href: "/dashboard/product/settlements", label: "Payments", icon: DollarSign },
      { href: "/dashboard/product/profile", label: "Profile", icon: User },
    ];
  }, [isService, dashRoot]);

  async function logout() {
    await signOutVendorCompletely();
    router.replace("/");
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="max-w-md text-center text-destructive">{error}</p>
        <Link href="/" className="text-primary underline">
          Back to login
        </Link>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-[100dvh] bg-background">
        <aside className="hidden w-60 shrink-0 border-r border-border/50 bg-card p-4 lg:block">
          <Skeleton className="mb-6 h-12 w-full rounded-xl" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </aside>
        <div className="flex flex-1 flex-col p-6">
          <Skeleton className="mb-6 h-10 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const status = String(me.status || "").toLowerCase();
  const isApproved = status === "active";
  const isRejected = status === "rejected";
  const showPendingBanner = !isApproved && !isRejected;
  const pageTitle = deriveHeaderTitle(pathname);

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Mobile drawer overlay */}
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Sidebar — desktop always; mobile slide-over */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-border/50 bg-card transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-border/50 p-4">
          <Link href={dashRoot} className="flex min-w-0 flex-1 items-center gap-3" onClick={() => setMobileNavOpen(false)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary p-1.5 shadow-md">
              <Image src="/logo.png" alt="P4U" width={32} height={32} className="h-full w-full object-contain" priority />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Vendor Portal</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {me.businessName || (isService ? "Service vendor" : "Product vendor")}
              </p>
            </div>
          </Link>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isVendorNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-primary/10 font-semibold text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border/50 p-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile branded header */}
        <header className="sticky top-0 z-30 bg-primary lg:hidden">
          <div
            className="flex items-center justify-between px-4 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                className="shrink-0 rounded-lg p-1 hover:bg-primary-foreground/10"
                aria-label="Open navigation menu"
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="h-6 w-6 text-primary-foreground" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold text-primary-foreground">{me.businessName || "Vendor Portal"}</h1>
                <div className="flex items-center gap-1">
                  <Store className="h-3 w-3 text-primary-foreground/60" />
                  <p className="truncate text-[10px] text-primary-foreground/60">{displayName}</p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15" aria-label="Notifications">
                <Bell className="h-4 w-4 text-primary-foreground" />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15 text-sm font-bold text-primary-foreground">
                {vendorInitial}
              </div>
            </div>
          </div>
        </header>

        {/* Desktop header */}
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-border/50 bg-card/95 px-6 py-3 backdrop-blur-sm lg:flex">
          <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-full p-2 hover:bg-secondary" aria-label="Notifications">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {vendorInitial}
              </div>
              <div className="text-sm">
                <p className="font-medium">{displayName}</p>
                <p className="text-[10px] text-muted-foreground">{me.businessName}</p>
              </div>
            </div>
          </div>
        </header>

        {showPendingBanner ? (
          <div className="flex items-start gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground sm:px-6">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Profile pending verification</p>
              <p className="text-xs opacity-80">
                Your application is with admin for review. You can keep using the dashboard; some actions unlock after approval.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="shrink-0 rounded-md border border-warning/40 bg-card px-3 py-1 text-xs font-semibold hover:bg-warning/10"
            >
              Edit application
            </Link>
          </div>
        ) : null}

        {isRejected ? (
          <div className="flex items-start gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm sm:px-6">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">Application not approved</p>
              <p className="text-xs text-destructive/80">Please update your details and re-submit for review.</p>
            </div>
            <Link
              href="/onboarding"
              className="shrink-0 rounded-md border border-destructive/30 bg-card px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
            >
              Update application
            </Link>
          </div>
        ) : null}

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:pb-6 pb-24">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-in">{children}</div>
        </main>

        {/* Mobile bottom navigation — Planext4u-style */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-card/95 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          aria-label="Quick navigation"
        >
          <div className="flex items-center justify-around px-1 py-2">
            {mobileBottomNav.map(({ href, label, icon: Icon }) => {
              const active = isVendorNavActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

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
    dropshipping: "Dropshipping",
  };
  return map[last] ?? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
