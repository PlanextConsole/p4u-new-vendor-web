import { apiClient } from "@/lib/api/client";

export type VendorUploadResult = { url: string };

/** Upload a single image; returns public path e.g. `/vendor-uploads/…` (gateway + Next rewrite). */
export async function vendorUploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const data = await apiClient.postFormData<VendorUploadResult>("/api/v1/vendor/me/upload", fd);
  return data.url;
}
