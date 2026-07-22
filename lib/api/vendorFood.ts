import { apiClient } from './client';

const BASE = '/api/v1/commerce/food/vendor';

export interface VendorFoodRestaurant {
  id: string;
  vendorId: string;
  name: string;
  tagline: string | null;
  description: string | null;
  cuisine: string[] | null;
  vegOnly: boolean;
  coverImage: string | null;
  logoUrl: string | null;
  fssaiLicense: string | null;
  address: string;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  email: string | null;
  openingTime: string | null;
  closingTime: string | null;
  avgPrepMinutes: number;
  deliveryRadiusKm: string;
  packagingFee: string;
  minOrderAmount: string;
  status: 'open' | 'closed' | 'busy' | 'offline';
  isActive: boolean;
  rating: string;
  reviewsCount: number;
  totalOrders: number;
}

export interface VendorFoodMenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface VendorFoodMenuItem {
  id: string;
  restaurantId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: string;
  discountedPrice: string | null;
  isVeg: boolean;
  imageUrl: string | null;
  addons: Array<Record<string, unknown>> | null;
  customizations: Array<Record<string, unknown>> | null;
  prepMinutes: number;
  gstRate: string;
  inStock: boolean;
  isBestseller: boolean;
  displayOrder: number;
}

export interface VendorFoodOrder {
  id: string;
  orderRef: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  restaurantId: string;
  restaurantName: string;
  items: Array<Record<string, unknown>>;
  total: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: string;
  customerNotes: string | null;
  placedAt: string;
  createdAt: string;
}

export interface VendorFoodOrderList {
  items: VendorFoodOrder[];
  total: number;
  limit: number;
  offset: number;
}

export interface VendorFoodChatMessage {
  id: string;
  senderId: string;
  senderRole: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export const vendorFoodApi = {
  getRestaurant() {
    return apiClient.get<VendorFoodRestaurant | null>(`${BASE}/restaurant`);
  },

  saveRestaurant(input: Partial<VendorFoodRestaurant>) {
    return apiClient.put<VendorFoodRestaurant>(`${BASE}/restaurant`, input);
  },

  getMenu() {
    return apiClient.get<{
      restaurant: VendorFoodRestaurant;
      categories: VendorFoodMenuCategory[];
      items: VendorFoodMenuItem[];
    }>(`${BASE}/menu`);
  },

  createCategory(input: Pick<VendorFoodMenuCategory, 'name'> & Partial<VendorFoodMenuCategory>) {
    return apiClient.post<VendorFoodMenuCategory>(`${BASE}/menu/categories`, input);
  },

  updateCategory(categoryId: string, input: Partial<VendorFoodMenuCategory>) {
    return apiClient.patch<VendorFoodMenuCategory>(`${BASE}/menu/categories/${encodeURIComponent(categoryId)}`, input);
  },

  deleteCategory(categoryId: string) {
    return apiClient.delete<{ deleted: true }>(`${BASE}/menu/categories/${encodeURIComponent(categoryId)}`);
  },

  createMenuItem(input: Pick<VendorFoodMenuItem, 'name' | 'price'> & Partial<VendorFoodMenuItem>) {
    return apiClient.post<VendorFoodMenuItem>(`${BASE}/menu/items`, input);
  },

  updateMenuItem(itemId: string, input: Partial<VendorFoodMenuItem>) {
    return apiClient.patch<VendorFoodMenuItem>(`${BASE}/menu/items/${encodeURIComponent(itemId)}`, input);
  },

  deleteMenuItem(itemId: string) {
    return apiClient.delete<{ deleted: true }>(`${BASE}/menu/items/${encodeURIComponent(itemId)}`);
  },

  listOrders(params?: { status?: string; limit?: number; offset?: number }) {
    const query: Record<string, string | number> = {};
    if (params?.status) query.status = params.status;
    if (params?.limit != null) query.limit = params.limit;
    if (params?.offset != null) query.offset = params.offset;
    return apiClient.get<VendorFoodOrderList>(`${BASE}/orders`, query);
  },

  getOrder(orderId: string) {
    return apiClient.get<VendorFoodOrder>(`${BASE}/orders/${encodeURIComponent(orderId)}`);
  },

  updateOrderStatus(orderId: string, status: string, note?: string) {
    return apiClient.patch<VendorFoodOrder>(`${BASE}/orders/${encodeURIComponent(orderId)}/status`, { status, note });
  },

  listChat(orderId: string) {
    return apiClient.get<VendorFoodChatMessage[]>(`${BASE}/orders/${encodeURIComponent(orderId)}/chat`);
  },

  assignRider(orderId: string) {
    return apiClient.post<Record<string, unknown>>(`${BASE}/orders/${encodeURIComponent(orderId)}/assign-rider`, {});
  },

  notifyBackInStock(itemId: string) {
    return apiClient.post<{ notified: number }>(`${BASE}/menu/items/${encodeURIComponent(itemId)}/notify-stock`, {});
  },

  listCombos() {
    return apiClient.get<Array<Record<string, unknown>>>(`${BASE}/combos`);
  },

  createCombo(input: Record<string, unknown>) {
    return apiClient.post<Record<string, unknown>>(`${BASE}/combos`, input);
  },
  updateCombo(comboId: string, input: Record<string, unknown>) {
    return apiClient.put<Record<string, unknown>>(`${BASE}/combos/${encodeURIComponent(comboId)}`, input);
  },
  sendChat(orderId: string, message: string) {
    return apiClient.post<VendorFoodChatMessage>(`${BASE}/orders/${encodeURIComponent(orderId)}/chat`, { message });
  },
};
