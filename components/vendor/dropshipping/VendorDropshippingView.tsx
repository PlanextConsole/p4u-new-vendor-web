"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Package, ShieldCheck, Truck } from "lucide-react";
import {
  vendorDropshippingApi,
  type DropshippingOrderRow,
  type DropshippingSupplierRow,
  type VendorDropshippingSettings,
} from "@/lib/api/vendorDropshipping";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { VendorFormLayout, VendorStatusBadge } from "@/components/vendor/VendorListUi";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="h-6 w-11 rounded-full bg-muted transition peer-checked:bg-primary" />
      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-card shadow transition peer-checked:translate-x-5" />
    </label>
  );
}

const defaultSettings = (vendorId = ""): VendorDropshippingSettings => ({
  vendorId,
  enabled: false,
  defaultSupplierId: null,
  autoForwardOrders: false,
  defaultMarginPercent: 20,
  notifyOnStatusChange: true,
});

export default function VendorDropshippingView() {
  const [platformEnabled, setPlatformEnabled] = useState(true);
  const [settings, setSettings] = useState<VendorDropshippingSettings>(defaultSettings());
  const [suppliers, setSuppliers] = useState<DropshippingSupplierRow[]>([]);
  const [orders, setOrders] = useState<DropshippingOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [bundle, sup, list] = await Promise.all([
        vendorDropshippingApi.getSettings(),
        vendorDropshippingApi.listSuppliers(),
        vendorDropshippingApi.listOrders({ limit: 10, offset: 0 }),
      ]);
      setPlatformEnabled(bundle.platformEnabled);
      setSettings(bundle.settings || defaultSettings());
      setSuppliers(sup.items || []);
      setOrders(list.items || []);
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      const bundle = await vendorDropshippingApi.saveSettings({
        enabled: settings.enabled,
        defaultSupplierId: settings.defaultSupplierId,
        autoForwardOrders: settings.autoForwardOrders,
        defaultMarginPercent: settings.defaultMarginPercent,
        notifyOnStatusChange: settings.notifyOnStatusChange,
      });
      setPlatformEnabled(bundle.platformEnabled);
      setSettings(bundle.settings);
      setOk("Dropshipping settings saved.");
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function forward(row: DropshippingOrderRow) {
    setActionId(row.id);
    setErr("");
    try {
      await vendorDropshippingApi.forwardOrder(row.id);
      await load();
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Forward failed");
    } finally {
      setActionId(null);
    }
  }

  if (loading) {
    return (
      <VendorFormLayout width="md">
        <Card className="h-32 animate-pulse bg-muted" />
      </VendorFormLayout>
    );
  }

  return (
    <VendorFormLayout width="md" className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>
      ) : null}
      {ok ? (
        <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{ok}</div>
      ) : null}

      {!platformEnabled ? (
        <Card className="flex items-start gap-3 border-warning/40 bg-warning/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold">Dropshipping is currently disabled platform-wide.</p>
            <p className="text-xs text-muted-foreground">
              An administrator must enable it in platform settings before orders can be forwarded.
            </p>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Dropshipping</h2>
            <p className="text-sm text-muted-foreground">
              Sell catalog items without holding inventory — orders are forwarded to your chosen supplier.
            </p>
          </div>
          <Toggle checked={settings.enabled} onChange={(v) => setSettings((s) => ({ ...s, enabled: v }))} label="Enable dropshipping" />
        </div>

        {settings.enabled ? (
          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <label className="text-sm font-medium" htmlFor="default-supplier">
                Default supplier
              </label>
              <select
                id="default-supplier"
                value={settings.defaultSupplierId || ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, defaultSupplierId: e.target.value || null }))
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">— Select supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.countryCode || "—"} · {s.currencyCode} · {s.defaultLeadTimeDays}d lead)
                  </option>
                ))}
              </select>
              {suppliers.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No active suppliers — contact admin to add one.</p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium" htmlFor="margin-pct">
                Your margin %
              </label>
              <Input
                id="margin-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={settings.defaultMarginPercent}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    defaultMarginPercent: parseFloat(e.target.value) || 0,
                  }))
                }
                className="mt-1.5 h-11 rounded-xl"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Added on top of supplier cost when listing prices are auto-calculated.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Auto-forward orders</p>
                  <p className="text-xs text-muted-foreground">Send each customer order to your supplier automatically.</p>
                </div>
              </div>
              <Toggle
                checked={settings.autoForwardOrders}
                onChange={(v) => setSettings((s) => ({ ...s, autoForwardOrders: v }))}
                label="Auto-forward orders"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Notify me on status changes</p>
                  <p className="text-xs text-muted-foreground">Alerts when supplier marks shipped or delivered.</p>
                </div>
              </div>
              <Toggle
                checked={settings.notifyOnStatusChange}
                onChange={(v) => setSettings((s) => ({ ...s, notifyOnStatusChange: v }))}
                label="Notify on status changes"
              />
            </div>
          </div>
        ) : null}

        <Button type="button" onClick={() => void save()} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="text-sm font-semibold">Recent supplier orders</h3>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No supplier orders yet.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => {
              const st = o.status.toLowerCase();
              const canForward = st === "pending";
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium">{o.orderId}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString("en-IN") : "—"} · {o.currencyCode}{" "}
                      {Number(o.costTotal || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <VendorStatusBadge status={o.status} kind="order" />
                    {canForward ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={actionId === o.id || !platformEnabled}
                        onClick={() => void forward(o)}
                      >
                        Forward
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </VendorFormLayout>
  );
}
