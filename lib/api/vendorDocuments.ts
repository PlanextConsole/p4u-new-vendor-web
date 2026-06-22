import { apiClient } from "./client";

export type VendorDocumentUploadResult = {
  url: string;
  mimeType?: string;
  size?: number;
  originalName?: string;
};

/** Upload KYC / compliance document (PDF or image). */
export async function vendorUploadDocument(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const data = await apiClient.postFormData<VendorDocumentUploadResult>("/api/v1/vendor/me/documents/upload", fd);
  return data.url;
}
