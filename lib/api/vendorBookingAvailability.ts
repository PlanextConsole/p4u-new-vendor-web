import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

export type DayScheduleDTO = {
  enabled: boolean;
  start: string;
  end: string;
  bufferMinutes: number;
  customSlots: { start: string; end: string }[];
};

export type BookingAvailabilityDTO = {
  version: 1;
  todayClosed?: boolean;
  defaultSlotMinutes?: number;
  weekly: Record<string, DayScheduleDTO>;
  dateOffs: { date: string; reason?: string | null }[];
};

export function defaultBookingAvailability(): BookingAvailabilityDTO {
  const weekly: Record<string, DayScheduleDTO> = {};
  for (let d = 0; d < 7; d++) {
    const weekend = d === 0 || d === 6;
    weekly[String(d)] = {
      enabled: !weekend,
      start: "09:00",
      end: "18:00",
      bufferMinutes: 30,
      customSlots: [],
    };
  }
  return { version: 1, todayClosed: false, defaultSlotMinutes: 60, weekly, dateOffs: [] };
}

export const vendorBookingAvailabilityApi = {
  get() {
    return apiClient.get<{ availability: BookingAvailabilityDTO | null }>(`${BASE}/me/booking-availability`);
  },
  save(body: BookingAvailabilityDTO) {
    return apiClient.put<{ availability: BookingAvailabilityDTO }>(`${BASE}/me/booking-availability`, body);
  },
};
