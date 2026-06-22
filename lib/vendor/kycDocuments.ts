/** KYC document keys aligned with admin `documentsJson` (gstCertificateUrl, panCardUrl) + vendor Aadhaar. */

export type KycDocKind = "aadhaar" | "pan" | "gst";

export const KYC_DOC_META: Record<
  KycDocKind,
  { title: string; urlKey: string; fileNameKey: string; optional?: boolean }
> = {
  aadhaar: { title: "Aadhaar Card", urlKey: "aadhaarCardUrl", fileNameKey: "aadhaarCardFileName" },
  pan: { title: "PAN Card", urlKey: "panCardUrl", fileNameKey: "panCardFileName" },
  gst: {
    title: "GST Certificate",
    urlKey: "gstCertificateUrl",
    fileNameKey: "gstCertificateFileName",
    optional: true,
  },
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function isKycDocSubmitted(
  documentsJson: Record<string, unknown> | null | undefined,
  kind: KycDocKind,
): boolean {
  const meta = KYC_DOC_META[kind];
  const docs =
    documentsJson && typeof documentsJson === "object" && !Array.isArray(documentsJson) ? documentsJson : {};
  return Boolean(str(docs[meta.urlKey]) || str(docs[meta.fileNameKey]));
}

export function kycDocViewUrl(
  documentsJson: Record<string, unknown> | null | undefined,
  kind: KycDocKind,
): string {
  const meta = KYC_DOC_META[kind];
  const docs =
    documentsJson && typeof documentsJson === "object" && !Array.isArray(documentsJson) ? documentsJson : {};
  return str(docs[meta.urlKey]);
}
