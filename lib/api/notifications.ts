import { apiClient } from "./client";

const BASE = "/api/v1/notifications";

export interface UserNotificationRow {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const notificationsApi = {
  list() {
    return apiClient.get<UserNotificationRow[]>(`${BASE}/me`);
  },

  markRead(id: string) {
    return apiClient.post<UserNotificationRow>(`${BASE}/me/${encodeURIComponent(id)}/read`);
  },

  async markAllRead(items: UserNotificationRow[]) {
    const unread = items.filter((n) => String(n.status || "").toLowerCase() !== "read");
    await Promise.all(unread.map((n) => notificationsApi.markRead(n.id)));
  },
};
