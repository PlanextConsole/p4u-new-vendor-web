"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Save, Trash2 } from "lucide-react";
import {
  vendorBookingAvailabilityApi,
  defaultBookingAvailability,
  type BookingAvailabilityDTO,
  type DayScheduleDTO,
} from "@/lib/api/vendorBookingAvailability";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function mergeAvailability(raw: unknown): BookingAvailabilityDTO {
  const base = defaultBookingAvailability();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1) return base;
  const w = o.weekly;
  if (!w || typeof w !== "object") return base;
  const weekly: Record<string, DayScheduleDTO> = { ...base.weekly };
  for (let d = 0; d < 7; d++) {
    const k = String(d);
    const src = (w as Record<string, unknown>)[k];
    if (!src || typeof src !== "object") continue;
    const row = src as Record<string, unknown>;
    weekly[k] = {
      enabled: Boolean(row.enabled),
      start: typeof row.start === "string" ? row.start : weekly[k].start,
      end: typeof row.end === "string" ? row.end : weekly[k].end,
      bufferMinutes: Number.isFinite(Number(row.bufferMinutes)) ? Number(row.bufferMinutes) : weekly[k].bufferMinutes,
      customSlots: Array.isArray(row.customSlots)
        ? (row.customSlots as unknown[])
            .filter((x) => x && typeof x === "object")
            .map((x) => {
              const s = x as Record<string, unknown>;
              return { start: String(s.start || "09:00"), end: String(s.end || "18:00") };
            })
        : [],
    };
  }
  return {
    version: 1,
    todayClosed: typeof o.todayClosed === "boolean" ? o.todayClosed : false,
    defaultSlotMinutes:
      Number.isFinite(Number(o.defaultSlotMinutes)) && Number(o.defaultSlotMinutes) > 0
        ? Math.min(480, Math.max(15, Number(o.defaultSlotMinutes)))
        : base.defaultSlotMinutes,
    weekly,
    dateOffs: Array.isArray(o.dateOffs)
      ? (o.dateOffs as unknown[])
          .filter((x) => x && typeof x === "object")
          .map((x) => {
            const s = x as Record<string, unknown>;
            return { date: String(s.date || "").slice(0, 10), reason: s.reason != null ? String(s.reason) : null };
          })
          .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date))
      : [],
  };
}

function format12h(hm: string): string {
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hm;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${ap}`;
}

export function VendorAvailabilityEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [state, setState] = useState<BookingAvailabilityDTO>(() => defaultBookingAvailability());

  const [offDate, setOffDate] = useState("");
  const [offReason, setOffReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await vendorBookingAvailabilityApi.get();
      setState(mergeAvailability(res.availability));
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dayIndices = useMemo(() => [0, 1, 2, 3, 4, 5, 6], []);

  function setDay(k: string, patch: Partial<DayScheduleDTO>) {
    setState((s) => ({
      ...s,
      weekly: { ...s.weekly, [k]: { ...s.weekly[k], ...patch } },
    }));
  }

  function addCustomSlot(dayKey: string) {
    const d = state.weekly[dayKey];
    const next = [...(d.customSlots || []), { start: d.start, end: d.end }];
    setDay(dayKey, { customSlots: next });
  }

  function removeCustomSlot(dayKey: string, idx: number) {
    const d = state.weekly[dayKey];
    setDay(dayKey, { customSlots: d.customSlots.filter((_, i) => i !== idx) });
  }

  function updateCustomSlot(dayKey: string, idx: number, patch: Partial<{ start: string; end: string }>) {
    const d = state.weekly[dayKey];
    const next = d.customSlots.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    setDay(dayKey, { customSlots: next });
  }

  function addDateOff() {
    const d = offDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setErr("Use a valid date (YYYY-MM-DD).");
      return;
    }
    if (state.dateOffs.some((o) => o.date === d)) {
      setErr("That date is already marked off.");
      return;
    }
    setState((s) => ({
      ...s,
      dateOffs: [...s.dateOffs, { date: d, reason: offReason.trim() || null }],
    }));
    setOffDate("");
    setOffReason("");
    setErr("");
  }

  function removeDateOff(date: string) {
    setState((s) => ({ ...s, dateOffs: s.dateOffs.filter((o) => o.date !== date) }));
  }

  async function save() {
    setSaving(true);
    setErr("");
    setOk("");
    try {
      await vendorBookingAvailabilityApi.save(state);
      setOk("Saved. Customer booking times will use this schedule.");
      await load();
    } catch (e: unknown) {
      setErr(e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading availability…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}
      {ok ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{ok}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-6 w-6 text-[#20a090]" aria-hidden />
          <div>
            <p className="text-base font-semibold text-slate-900">Today&apos;s Status</p>
            <p className="text-sm text-slate-600">Quick on/off for today only. Customers won&apos;t see slots today when off.</p>
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={!state.todayClosed}
            onChange={(e) => setState((s) => ({ ...s, todayClosed: !e.target.checked }))}
          />
          <span className="h-9 w-16 rounded-full bg-slate-200 transition peer-checked:bg-[#20a090]" />
          <span className="absolute left-1 top-1 h-7 w-7 rounded-full bg-white shadow transition peer-checked:translate-x-7" />
        </label>
      </div>

      <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">Manage Time Slots</p>
            <p className="text-sm text-slate-600">
              Working hours per day, buffer between generated slots, optional custom windows shoppers can book.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#20a090] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#188a7c] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4 border-b border-slate-100 pb-6">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default slot length</span>
            <input
              type="number"
              min={15}
              max={480}
              className="input mt-1 w-28"
              value={state.defaultSlotMinutes ?? 60}
              onChange={(e) =>
                setState((s) => ({ ...s, defaultSlotMinutes: Math.min(480, Math.max(15, parseInt(e.target.value, 10) || 60)) }))
              }
            />
            <span className="ml-2 text-sm text-slate-500">minutes (when no custom slots)</span>
          </label>
        </div>

        <div className="space-y-5">
          {dayIndices.map((d) => {
            const k = String(d);
            const row = state.weekly[k];
            return (
              <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex min-w-[140px] items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-[#20a090]"
                      checked={row.enabled}
                      onChange={(e) => setDay(k, { enabled: e.target.checked })}
                    />
                    <span className="font-semibold text-slate-900">{DAY_LABELS[d]}</span>
                  </label>
                  {row.enabled ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <input
                          type="time"
                          className="input w-[7.5rem] py-2 text-sm"
                          value={row.start}
                          onChange={(e) => setDay(k, { start: e.target.value })}
                        />
                        <span className="text-slate-500">to</span>
                        <input
                          type="time"
                          className="input w-[7.5rem] py-2 text-sm"
                          value={row.end}
                          onChange={(e) => setDay(k, { end: e.target.value })}
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">Buffer</span>
                        <input
                          type="number"
                          min={0}
                          max={240}
                          className="input w-20 py-2 text-sm"
                          value={row.bufferMinutes}
                          onChange={(e) => setDay(k, { bufferMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        />
                        <span className="text-slate-500">min</span>
                      </label>
                    </>
                  ) : null}
                </div>

                {row.enabled ? (
                  <div className="mt-4 border-t border-slate-200/80 pt-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Custom Time Slots</p>
                        <p className="text-xs text-slate-500">
                          If empty, bookable times are auto-generated from working hours using default slot length + buffer.
                          Add explicit windows to offer those as discrete choices.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addCustomSlot(k)}
                        className="text-sm font-semibold text-[#20a090] hover:underline"
                      >
                        + Add Slot
                      </button>
                    </div>
                    {row.customSlots.length === 0 ? (
                      <p className="text-xs text-slate-500">No custom slots — generation uses working hours.</p>
                    ) : (
                      <ul className="space-y-2">
                        {row.customSlots.map((slot, idx) => (
                          <li key={`${k}-${idx}`} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                            <input
                              type="time"
                              className="input w-[7rem] py-1.5 text-sm"
                              value={slot.start}
                              onChange={(e) => updateCustomSlot(k, idx, { start: e.target.value })}
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="time"
                              className="input w-[7rem] py-1.5 text-sm"
                              value={slot.end}
                              onChange={(e) => updateCustomSlot(k, idx, { end: e.target.value })}
                            />
                            <span className="text-xs text-slate-500">
                              {format12h(slot.start)} – {format12h(slot.end)}
                            </span>
                            <button
                              type="button"
                              aria-label="Remove slot"
                              className="ml-auto text-red-600 hover:text-red-800"
                              onClick={() => removeCustomSlot(k, idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[14px] border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-base font-semibold text-slate-900">Holidays &amp; Date-Specific Off</p>
        <p className="mt-1 text-sm text-slate-600">
          Mark specific upcoming dates as unavailable. (Blocking when bookings already exist can be enforced in a later
          release.)
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Date</span>
            <input type="date" className="input mt-1 py-2" value={offDate} onChange={(e) => setOffDate(e.target.value)} />
          </label>
          <label className="block min-w-[200px] flex-1">
            <span className="text-xs font-semibold text-slate-600">Reason (optional)</span>
            <input
              className="input mt-1 w-full py-2"
              placeholder="Holiday, leave, etc."
              value={offReason}
              onChange={(e) => setOffReason(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={addDateOff}
            className="rounded-xl bg-[#20a090] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#188a7c]"
          >
            + Mark Off
          </button>
        </div>
        {state.dateOffs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No upcoming days marked off.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {state.dateOffs.map((o) => (
              <li key={o.date} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{o.date}</span>
                  {o.reason ? <span className="text-slate-600"> — {o.reason}</span> : null}
                </span>
                <button type="button" className="text-red-600 hover:underline" onClick={() => removeDateOff(o.date)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
