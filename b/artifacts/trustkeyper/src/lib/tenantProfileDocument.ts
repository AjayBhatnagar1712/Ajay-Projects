import type { ExtendedDocumentId } from "@workspace/tenant-document-upload";
import { fetchTenantUploadedDocumentFile } from "./publicAgreementDocumentUpload";
import type { TenantDocumentMeta } from "./tenantProfile";

export function formatDocumentMimeLabel(mimeType?: string): string {
  if (!mimeType) return "Unknown type";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "Image";
  return mimeType.split("/").pop()?.toUpperCase() ?? mimeType;
}

export function formatDocumentUploadedAt(uploadedAt?: number): string {
  if (!uploadedAt) return "—";
  return new Date(uploadedAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tenantDocumentHasPersistedRecord(meta?: TenantDocumentMeta): boolean {
  return Boolean(meta?.fileName);
}

export function tenantDocumentCanPreview(meta?: TenantDocumentMeta): boolean {
  return Boolean(meta?.previewAvailable || meta?.dataUrl);
}

export async function resolveTenantDocumentDataUrl(
  meta: TenantDocumentMeta | undefined,
  token: string | undefined,
  documentId: ExtendedDocumentId,
): Promise<string | null> {
  if (meta?.dataUrl) return meta.dataUrl;
  if (!token || !meta?.fileName) return null;

  const remote = await fetchTenantUploadedDocumentFile(token, documentId);
  if (!remote.ok) return null;
  return remote.file.dataUrl;
}

export function openTenantDocumentPreview(dataUrl: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = fileName;
  anchor.click();
}
