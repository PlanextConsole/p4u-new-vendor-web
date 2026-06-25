import { apiClient } from "./client";

const BASE = "/api/v1/vendor";

export interface VendorMediaFolder {
  id: string;
  vendorId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VendorMediaAsset {
  id: string;
  vendorId: string;
  folderId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  url: string;
  createdAt?: string;
}

export const vendorMediaApi = {
  listFolders() {
    return apiClient.get<{ items: VendorMediaFolder[] }>(`${BASE}/me/media/folders`);
  },

  createFolder(name: string) {
    return apiClient.post<VendorMediaFolder>(`${BASE}/me/media/folders`, { name });
  },

  listFolderAssets(folderId: string) {
    return apiClient.get<{ folder: VendorMediaFolder; items: VendorMediaAsset[] }>(
      `${BASE}/me/media/folders/${encodeURIComponent(folderId)}/assets`,
    );
  },

  searchAssets(params?: { q?: string; type?: "images" | "documents" | "all"; limit?: number; offset?: number }) {
    const q: Record<string, string | number> = {};
    if (params?.q) q.q = params.q;
    if (params?.type) q.type = params.type;
    if (params?.limit != null) q.limit = params.limit;
    if (params?.offset != null) q.offset = params.offset;
    return apiClient.get<{ items: VendorMediaAsset[]; total: number; limit: number; offset: number }>(
      `${BASE}/me/media/assets`,
      q,
    );
  },

  async uploadToFolder(folderId: string, file: File): Promise<VendorMediaAsset> {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.postFormData<VendorMediaAsset>(
      `${BASE}/me/media/folders/${encodeURIComponent(folderId)}/upload`,
      fd,
    );
  },

  deleteAsset(assetId: string) {
    return apiClient.delete<{ ok: boolean }>(`${BASE}/me/media/assets/${encodeURIComponent(assetId)}`);
  },

  moveAsset(assetId: string, folderId: string) {
    return apiClient.patch<VendorMediaAsset>(
      `${BASE}/me/media/assets/${encodeURIComponent(assetId)}`,
      { folderId },
    );
  },
};
