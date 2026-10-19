export const AGREEMENT_DEFAULT_DOCUMENT_IDS = ["aadhaar", "pan", "bank"] as const;

export type AgreementDocumentId = (typeof AGREEMENT_DEFAULT_DOCUMENT_IDS)[number];

export type ExtendedDocumentId =
  | AgreementDocumentId
  | "passport"
  | "driving_license"
  | "employment_id"
  | "salary_slip"
  | "bank_statement"
  | "supporting";

export type UploadDocumentStatus =
  | "not_uploaded"
  | "uploading"
  | "uploaded"
  | "rejected"
  | "reupload_required";

export const DOCUMENT_LABELS: Record<ExtendedDocumentId, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  bank: "Bank Account Details",
  passport: "Passport",
  driving_license: "Driving License",
  employment_id: "Employment ID",
  salary_slip: "Salary Slips",
  bank_statement: "Bank Statements",
  supporting: "Additional Supporting Documents",
};

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
] as const;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function documentLabel(id: ExtendedDocumentId): string {
  return DOCUMENT_LABELS[id];
}

export function isFileDocumentId(id: ExtendedDocumentId): boolean {
  return id !== "bank";
}
