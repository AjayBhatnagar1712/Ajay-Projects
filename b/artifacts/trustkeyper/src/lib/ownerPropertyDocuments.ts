import { getAgreements } from "@/lib/agreements";
import { queueCloudSync } from "@/lib/cloudSync";
import { getItem, setItem } from "@/lib/storageKeys";

export type PropertyDocumentSource = "upload" | "agreement";

export interface PropertyDocument {
  id: string;
  propertyId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  dataUrl: string;
  source: PropertyDocumentSource;
  agreementId?: string;
  uploadedAt: number;
}

const STORAGE_KEY = "owner_property_documents";

function readUploads(): PropertyDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PropertyDocument[]) : [];
  } catch {
    return [];
  }
}

function persistUploads(list: PropertyDocument[]): void {
  try {
    const json = JSON.stringify(list);
    setItem(STORAGE_KEY, json);
    queueCloudSync(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
}

function agreementDocuments(propertyId: string): PropertyDocument[] {
  return getAgreements()
    .filter((a) => a.propertyId === propertyId)
    .flatMap((a) => {
      if (a.documents?.length) {
        return a.documents.map((doc, i) => ({
          id: `agr_${a.id}_${i}`,
          propertyId,
          fileName: doc.name || `Rental Agreement — ${a.tenantName || "Tenant"}`,
          fileSize: 0,
          dataUrl: doc.dataUrl,
          source: "agreement" as const,
          agreementId: a.id,
          uploadedAt: a.createdAt,
        }));
      }
      return [
        {
          id: `agr_meta_${a.id}`,
          propertyId,
          fileName: `Rental Agreement — ${a.tenantName || "Tenant"}`,
          fileSize: 0,
          dataUrl: "",
          source: "agreement" as const,
          agreementId: a.id,
          uploadedAt: a.createdAt,
        },
      ];
    });
}

export function getPropertyDocuments(propertyId: string): PropertyDocument[] {
  const uploads = readUploads().filter((d) => d.propertyId === propertyId);
  return [...agreementDocuments(propertyId), ...uploads].sort(
    (a, b) => b.uploadedAt - a.uploadedAt,
  );
}

export function addPropertyDocumentUpload(
  propertyId: string,
  file: File,
): Promise<PropertyDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const doc: PropertyDocument = {
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        propertyId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        dataUrl,
        source: "upload",
        uploadedAt: Date.now(),
      };
      const list = readUploads();
      list.unshift(doc);
      persistUploads(list);
      resolve(doc);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function removePropertyDocumentUpload(propertyId: string, docId: string): void {
  const list = readUploads().filter(
    (d) => !(d.propertyId === propertyId && d.id === docId && d.source === "upload"),
  );
  persistUploads(list);
}

export function formatDocumentSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
