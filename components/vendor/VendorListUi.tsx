"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Planext4u list page content column (`max-w-5xl`). */
export function VendorListLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-5xl space-y-6", className)}>{children}</div>;
}

export type ListStatItem = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconClass?: string;
  valueClass?: string;
};

/** Reference: `grid-cols-2 md:grid-cols-4`, `Card p-3`, compact label + value. */
export function VendorListStatRow({ items }: { items: ListStatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((s) => (
        <Card key={s.label} className="p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <s.icon className={cn("h-3.5 w-3.5 shrink-0", s.iconClass)} aria-hidden />
            <span>{s.label}</span>
          </div>
          <p className={cn("text-lg font-bold text-foreground", s.valueClass)}>{s.value}</p>
        </Card>
      ))}
    </div>
  );
}

/** Reference bookings (3-col) or settlements (2×2 / 4-col) centered stat cards. */
export function VendorListStatRowCentered({
  items,
  cols = 3,
}: {
  items: ListStatItem[];
  cols?: 3 | 4;
}) {
  return (
    <div className={cn("grid gap-3", cols === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3")}>
      {items.map((s) => (
        <Card key={s.label} className="p-3 text-center">
          <s.icon className={cn("mx-auto h-5 w-5", s.iconClass)} aria-hidden />
          <p className={cn("mt-1 text-lg font-bold", s.valueClass)}>{s.value}</p>
          <p className="text-xs text-muted-foreground">{s.label}</p>
        </Card>
      ))}
    </div>
  );
}

/** Reference payments: horizontal icon + text stat cards. */
export function VendorListStatRowHorizontal({ items }: { items: ListStatItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {items.map((s, i) => (
        <Card
          key={s.label}
          className={cn("flex items-center gap-3 p-4", i === 2 && "col-span-2 lg:col-span-1")}
        >
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", s.iconClass)}>
            <s.icon className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-lg font-bold", s.valueClass)}>{s.value}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

const ORDER_STATUS_CLASS: Record<string, string> = {
  placed: "bg-primary/10 text-primary",
  paid: "bg-info/10 text-info",
  accepted: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  shipped: "bg-info/10 text-info",
  delivered: "bg-success/10 text-success",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-destructive/10 text-destructive",
  pending: "bg-warning/10 text-warning",
  rejected: "bg-destructive/10 text-destructive",
  approved: "bg-info/10 text-info",
};

const SETTLEMENT_STATUS_CLASS: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  eligible: "bg-info/10 text-info",
  settled: "bg-success/10 text-success",
  completed: "bg-success/10 text-success",
  paid: "bg-success/10 text-success",
  on_hold: "bg-destructive/10 text-destructive",
  rejected: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
  created: "bg-warning/10 text-warning",
  processing: "bg-warning/10 text-warning",
  queued: "bg-warning/10 text-warning",
};

const PRODUCT_STATUS_CLASS: Record<string, string> = {
  active: "bg-success/10 text-success",
  inactive: "bg-destructive/10 text-destructive",
  draft: "bg-muted text-muted-foreground",
  pending_approval: "bg-warning/10 text-warning",
};

export function VendorStatusBadge({
  status,
  kind = "order",
  className,
}: {
  status: string;
  kind?: "order" | "settlement" | "product";
  className?: string;
}) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const map =
    kind === "settlement" ? SETTLEMENT_STATUS_CLASS : kind === "product" ? PRODUCT_STATUS_CLASS : ORDER_STATUS_CLASS;
  const tone = map[key] || "bg-muted text-muted-foreground";
  const label = status.replace(/_/g, " ");
  return (
    <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize", tone, className)}>
      {label}
    </span>
  );
}

export function VendorListTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-0">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "rounded-t-lg px-4 py-2 text-sm font-medium transition",
            active === t.key
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function VendorListPagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className={cn("mt-6 flex items-center justify-center gap-2", className)}>
      <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

export function VendorListEmpty({
  icon: Icon,
  title,
  subtitle,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <Card className="p-8 text-center">
      {Icon ? <Icon className="mx-auto mb-2 h-10 w-10 text-muted-foreground/30" aria-hidden /> : null}
      <p className="text-sm text-muted-foreground">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </Card>
  );
}

export function VendorListToolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-3">{children}</div>;
}

/** Form / settings pages — Planext4u content widths. */
export function VendorFormLayout({
  children,
  width = "md",
  className,
}: {
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
  className?: string;
}) {
  const max =
    width === "sm" ? "max-w-lg" : width === "lg" ? "max-w-3xl" : "max-w-2xl";
  return <div className={cn("mx-auto w-full space-y-6", max, className)}>{children}</div>;
}
