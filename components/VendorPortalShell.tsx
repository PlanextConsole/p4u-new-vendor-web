"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  Clock3,
  CreditCard,
  DollarSign,
  HelpCircle,
  History,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  User,
  Wrench,
} from "lucide-react";
import { getStoredUsername, hasVendorSession, signOutVendorCompletely } from "@/lib/authSession";
import { getVendorMe, type VendorProfile } from "@/lib/api/vendor";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorNotificationBell } from "@/components/vendor/VendorNotificationBell";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const CUSTOMER_APP_URL = (process.env.NEXT_PUBLIC_CUSTOMER_WEB_URL || "http://localhost:3000").replace(/\/$/, "");

export default function VendorPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<VendorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!hasVendorSession()) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await getVendorMe();
        if (cancelled) return;
        setMe(profile);
      } catch (e: unknown) {
        if (cancelled) return;
        const status =
          e && typeof e === "object" && "status" in e ? Number((e as { status?: number }).status) : NaN;
        if (status === 401) {
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
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const vendorType = String(me?.vendorType || "").toUpperCase();
  const isService = vendorType === "SERVICE";
  const displayName = me?.ownerName || me?.businessName || getStoredUsername() || "Vendor";
  const vendorInitial = displayName.trim().charAt(0).toUpperCase() || "V";

  const serviceLinks: NavLink[] = [
    { href: "/dashboard/service", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/service/services", label: "Services", icon: Wrench },
    { href: "/dashboard/service/availability", label: "Availability", icon: CalendarClock },
    { href: "/dashboard/service/bookings", label: "Bookings", icon: CalendarCheck },
    { href: "/dashboard/service/settlements", label: "Settlements", icon: DollarSign },
    { href: "/dashboard/service/payments", label: "Payment History", icon: History },
    { href: "/dashboard/service/bank", label: "Bank Account", icon: CreditCard },
    { href: "/dashboard/service/profile", label: "Profile & Settings", icon: User },
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
    { href: "/dashboard/product/profile", label: "Profile & Settings", icon: User },
    { href: "/dashboard/product/media", label: "Media Library", icon: ImageIcon },
    { href: "/dashboard/product/kyc", label: "KYC Verification", icon: ShieldCheck },
  ];

  const links = isService ? serviceLinks : productLinks;
  const dashRoot = isService ? "/dashboard/service" : "/dashboard/product";
  const settlementsHref = `${dashRoot}/settlements`;
  const profileHref = `${dashRoot}/profile`;
  const accountControlHref = `${dashRoot}/account-control`;
  const changePasswordHref = `${dashRoot}/change-password`;
  const helpHref = `${dashRoot}/help`;
  const ordersHref = isService ? "/dashboard/service/bookings" : "/dashboard/product/orders";

  const mobileBottomNav = useMemo((): NavLink[] => {
    if (isService) {
      return [
        { href: dashRoot, label: "Home", icon: LayoutDashboard },
        { href: "/dashboard/service/services", label: "Services", icon: Wrench },
        { href: "/dashboard/service/bookings", label: "Bookings", icon: ShoppingCart },
        { href: settlementsHref, label: "Payments", icon: DollarSign },
        { href: profileHref, label: "Profile", icon: User },
      ];
    }
    return [
      { href: dashRoot, label: "Home", icon: LayoutDashboard },
      { href: "/dashboard/product/products", label: "Products", icon: Package },
      { href: "/dashboard/product/orders", label: "Orders", icon: ShoppingCart },
      { href: settlementsHref, label: "Payments", icon: DollarSign },
      { href: profileHref, label: "Profile", icon: User },
    ];
  }, [isService, dashRoot, settlementsHref, profileHref]);

  const drawerQuickActions = useMemo(
    () => [
      {
        label: isService ? "Your\nBookings" : "Your\nOrders",
        icon: ShoppingCart,
        href: ordersHref,
      },
      { label: "Help &\nSupport", icon: HelpCircle, href: helpHref },
      { label: "Store\nInsights", icon: BarChart3, href: dashRoot },
    ],
    [isService, ordersHref, dashRoot, helpHref],
  );

  const drawerMoreItems = useMemo(
    () => [
      { label: "Account & Control", icon: Shield, href: accountControlHref },
      { label: "Change Password", icon: ShieldCheck, href: changePasswordHref },
      { label: "Settings", icon: Settings, href: profileHref },
    ],
    [profileHref, accountControlHref, changePasswordHref],
  );

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
        <aside className="hidden w-60 shrink-0 border-r border-border/50 bg-card lg:flex">
          <div className="w-full p-4">
            <Skeleton className="mb-6 h-12 w-full rounded-xl" />
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
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
      {/* Desktop sidebar — white, Planext4u-aligned */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/50 bg-card lg:flex">
        <div className="border-b border-border/50 p-4">
          <Link href={dashRoot} className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary p-1.5 shadow-md">
              <Image src="/logo.png" alt="P4U" width={32} height={32} className="h-full w-full object-contain" priority />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Vendor Portal</p>
              <p className="max-w-[140px] truncate text-[10px] text-[#64748B]">{me.businessName || displayName}</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isVendorNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn("vendor-nav-link", active && "vendor-nav-link-active")}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border/50 p-3">
          <a
            href={CUSTOMER_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="vendor-nav-link"
          >
            <Store className="h-4 w-4 shrink-0" />
            Customer App
          </a>
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

      <div className="flex min-w-0 flex-1 flex-col min-h-[100dvh]">
        {/* Mobile branded header */}
        <header className="sticky top-0 z-30 bg-primary lg:hidden">
          <div
            className="px-4 pb-3"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Link href={dashRoot} className="shrink-0">
                  <Image src="/logo.png" alt="P4U" width={32} height={32} className="h-8 w-8 rounded-lg object-contain" priority />
                </Link>
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-bold text-primary-foreground">{me.businessName || "Vendor Portal"}</h1>
                  <div className="flex items-center gap-1">
                    <Store className="h-3 w-3 text-primary-foreground/60" />
                    <p className="truncate text-[10px] text-primary-foreground/60">{displayName}</p>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={settlementsHref}
                  className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1.5"
                >
                  <TrendingUp className="h-3 w-3 text-primary-foreground/80" />
                  <span className="text-xs font-bold text-primary-foreground">Sales</span>
                </Link>
                <VendorNotificationBell
                  iconClassName="text-primary-foreground"
                  buttonClassName="h-9 w-9 rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25"
                />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15 hover:bg-primary-foreground/25"
                  aria-label="Open menu"
                >
                  <span className="text-sm font-bold text-primary-foreground">{vendorInitial}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Desktop header */}
        <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-border/50 bg-card/95 px-6 py-3 backdrop-blur-sm lg:flex">
          <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
          <div className="flex items-center gap-3">
            <VendorNotificationBell buttonClassName="rounded-full p-2 hover:bg-secondary" iconClassName="text-muted-foreground h-5 w-5" />
            <div className="flex items-center gap-2 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <span className="text-sm font-bold text-primary">{vendorInitial}</span>
              </div>
              <div>
                <span className="font-medium">{displayName}</span>
                <p className="text-[10px] text-[#64748B]">{me.businessName}</p>
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

        <main className="flex-1 pb-28 lg:pb-6">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-in px-4 py-5 sm:px-6 sm:py-6">{children}</div>
        </main>

        {/* Mobile bottom nav — Zepto-style pill */}
        <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-border/30 bg-card lg:hidden" aria-label="Quick navigation">
          <div className="relative flex items-center justify-around px-1 py-2">
            {mobileBottomNav.map(({ href, label, icon: Icon }) => {
              const active = isVendorNavActive(pathname, href);
              return (
                <Link key={href} href={href} className="relative flex flex-1 flex-col items-center">
                  <div className="relative z-10 flex flex-col items-center">
                    {active ? (
                      <div className="vendor-bottom-nav-pill relative -mt-7 flex flex-col items-center justify-center rounded-[18px] bg-primary px-3 py-2">
                        <Icon className="h-4 w-4 text-primary-foreground" />
                        <span className="mt-0.5 whitespace-nowrap text-[8px] font-bold leading-tight text-primary-foreground">
                          {label}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-1">
                        <Icon className="h-4 w-4 text-[#64748B]" />
                        <span className="mt-0.5 whitespace-nowrap text-[8px] font-medium leading-tight text-[#64748B]">
                          {label}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Full-screen mobile drawer */}
      {mobileMenuOpen ? (
        <div className="vendor-drawer-panel fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex items-center gap-3 border-b border-border/30 bg-card px-4 py-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50"
              aria-label="Close menu"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-lg font-bold">Menu</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="bg-card p-5">
              <Link href={profileHref} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-2xl font-bold text-primary">{vendorInitial}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold">{displayName}</p>
                  <p className="text-sm text-[#64748B]">{me.businessName}</p>
                  {me.email ? <p className="text-xs text-[#64748B]">{me.email}</p> : null}
                </div>
                <ChevronRight className="h-5 w-5 text-[#64748B]" />
              </Link>
            </div>

            <div className="px-5 py-4">
              <div className="grid grid-cols-3 gap-3">
                {drawerQuickActions.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/50 bg-card p-4 text-center transition-colors hover:bg-accent/50"
                  >
                    <action.icon className="h-5 w-5 text-foreground/70" />
                    <span className="whitespace-pre-line text-[11px] font-medium leading-tight text-foreground/80">
                      {action.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="px-5 pb-5">
              <Link
                href={settlementsHref}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-2xl border border-accent bg-accent/60 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="text-sm font-bold">Revenue & Settlements</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#64748B]" />
                </div>
                <p className="text-xs text-[#64748B]">Track your earnings and pending settlements</p>
              </Link>
            </div>

            <div className="px-5 pb-3">
              <p className="mb-3 text-sm font-bold">Store Management</p>
              <div className="divide-y divide-dashed divide-border/50 overflow-hidden rounded-2xl border border-border/50 bg-card">
                {links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/30"
                  >
                    <item.icon className="h-5 w-5 text-foreground/60" />
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-[#64748B]" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="px-5 pb-3 pt-2">
              <p className="mb-3 text-sm font-bold">More</p>
              <div className="divide-y divide-dashed divide-border/50 overflow-hidden rounded-2xl border border-border/50 bg-card">
                {drawerMoreItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent/30"
                  >
                    <item.icon className="h-5 w-5 text-foreground/60" />
                    <span className="flex-1 text-sm font-medium">{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-[#64748B]" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-3 px-5 py-4">
              <a
                href={CUSTOMER_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border/50 px-4 py-3 transition-colors hover:bg-accent/30"
              >
                <Store className="h-5 w-5 text-foreground/60" />
                <span className="text-sm font-medium">Switch to Customer App</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void logout();
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-destructive/20 px-4 py-3 text-destructive transition-colors hover:bg-destructive/5"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
    help: "Help & Support",
    "change-password": "Change Password",
    "account-control": "Account Ownership & Control",
    products: "My Products",
    dropshipping: "Dropshipping",
  };
  return map[last] ?? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
