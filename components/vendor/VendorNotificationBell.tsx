"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Check, Clock, DollarSign, ShoppingCart } from "lucide-react";
import { notificationsApi, type UserNotificationRow } from "@/lib/api/notifications";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof ShoppingCart> = {
  order: ShoppingCart,
  settlement: DollarSign,
  system: AlertTriangle,
};

const colorMap: Record<string, string> = {
  order: "text-primary bg-primary/10",
  settlement: "text-success bg-success/10",
  system: "text-warning bg-warning/10",
};

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function notificationType(row: UserNotificationRow): string {
  const meta = row.metadata;
  if (meta && typeof meta === "object" && typeof meta.type === "string") return meta.type;
  return "system";
}

function deepLink(row: UserNotificationRow): string | null {
  const meta = row.metadata;
  if (!meta || typeof meta !== "object") return null;
  const link =
    (typeof meta.deepLink === "string" && meta.deepLink) ||
    (typeof meta.deep_link === "string" && meta.deep_link) ||
    (typeof meta.href === "string" && meta.href);
  if (!link) return null;
  return link.replace(/^\/vendor\//, "/dashboard/product/");
}

export function VendorNotificationBell({
  iconClassName,
  buttonClassName,
}: {
  iconClassName?: string;
  buttonClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await notificationsApi.list();
      setItems(Array.isArray(rows) ? rows.slice(0, 30) : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const unreadCount = items.filter((n) => String(n.status || "").toLowerCase() !== "read").length;

  async function markAllRead() {
    await notificationsApi.markAllRead(items);
    void load();
  }

  async function onClickItem(row: UserNotificationRow) {
    if (String(row.status || "").toLowerCase() !== "read") {
      try {
        await notificationsApi.markRead(row.id);
        setItems((prev) => prev.map((n) => (n.id === row.id ? { ...n, status: "read" } : n)));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    const link = deepLink(row);
    if (link) router.push(link);
  }

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("relative", buttonClassName)}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
      >
        <Bell className={cn("h-[18px] w-[18px]", iconClassName)} />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">No notifications yet</p>
            ) : (
              items.map((n) => {
                const type = notificationType(n);
                const Icon = iconMap[type] || AlertTriangle;
                const colors = colorMap[type] || "text-muted-foreground bg-muted";
                const unread = String(n.status || "").toLowerCase() !== "read";
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void onClickItem(n)}
                    className={cn(
                      "flex w-full gap-3 border-b border-border/20 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50",
                      unread && "bg-primary/5",
                    )}
                  >
                    <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", colors)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>{n.title}</p>
                        {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                      </div>
                      {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p> : null}
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/70">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
