export const ALLOWED_DOC_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
export const ALLOWED_DOC_EXTENSIONS = ".pdf, .jpg, .jpeg, .png";

const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024;

export function isValidDocumentFile(file: File): boolean {
  return ALLOWED_DOC_TYPES.includes(file.type);
}

export function getFileTypeError(file: File): string | null {
  if (!isValidDocumentFile(file)) {
    return "Invalid file type. Please upload a JPG, PNG, or PDF file.";
  }
  if (file.size > MAX_DOC_SIZE_BYTES) {
    return "File too large. Maximum size is 5MB.";
  }
  return null;
}

export function isValidAccountNumber(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 18;
}

export function isValidIFSC(v: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim().toUpperCase());
}
