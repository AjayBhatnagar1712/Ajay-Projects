/**
 * Private Vercel Blob storage for signed lease PDFs.
 * Pathnames stay server-side; clients only ever receive authenticated byte streams.
 */
import { del, get, put } from "@vercel/blob";
import { sanitizeErrorForLog } from "./sanitizeErrorForLog.js";

const PDF_MAGIC = Buffer.from("%PDF", "utf8");
export const SIGNED_PDF_MAX_BYTES = 10 * 1024 * 1024;

export class SignedPdfBlobError extends Error {
  readonly code: "not_configured" | "invalid_pdf" | "too_large" | "store_failed" | "not_found";

  constructor(
    code: SignedPdfBlobError["code"],
    message: string,
  ) {
    super(message);
    this.name = "SignedPdfBlobError";
    this.code = code;
  }
}

function signedPdfBlobToken(): string | undefined {
  const token = process.env.SIGNED_PDF_READ_WRITE_TOKEN?.trim();
  return token && token.length > 0 ? token : undefined;
}

export function assertPdfBytes(bytes: Buffer, contentType: string | undefined): void {
  if (bytes.byteLength === 0) {
    throw new SignedPdfBlobError("invalid_pdf", "Signed PDF file is required.");
  }
  if (bytes.byteLength > SIGNED_PDF_MAX_BYTES) {
    throw new SignedPdfBlobError("too_large", "Signed PDF is too large — max 10MB.");
  }
  const mime = contentType?.split(";")[0]?.trim().toLowerCase();
  if (mime && mime !== "application/pdf") {
    throw new SignedPdfBlobError("invalid_pdf", "Signed file must be a PDF.");
  }
  if (bytes.subarray(0, 4).compare(PDF_MAGIC) !== 0) {
    throw new SignedPdfBlobError("invalid_pdf", "Signed file must be a PDF.");
  }
}

async function readWebStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/**
 * Stores a signed PDF in the private Blob store. Returns the store pathname only.
 */
export async function putSignedPdf(params: {
  agreementId: string;
  bytes: Buffer;
}): Promise<{ pathname: string }> {
  const token = signedPdfBlobToken();
  if (!token) {
    throw new SignedPdfBlobError(
      "not_configured",
      "Signed PDF storage is not configured.",
    );
  }

  try {
    const blob = await put(
      `signed-lease-agreements/${params.agreementId}/signed.pdf`,
      params.bytes,
      {
        access: "private",
        addRandomSuffix: true,
        contentType: "application/pdf",
        token,
      },
    );
    return { pathname: blob.pathname };
  } catch (err) {
    if (err instanceof SignedPdfBlobError) throw err;
    console.error("[signed-pdf-blob] put failed", sanitizeErrorForLog(err));
    throw new SignedPdfBlobError("store_failed", "Could not store the signed PDF.");
  }
}

export async function getSignedPdfBytes(pathname: string): Promise<Buffer> {
  const token = signedPdfBlobToken();
  if (!token) {
    throw new SignedPdfBlobError(
      "not_configured",
      "Signed PDF storage is not configured.",
    );
  }

  try {
    const result = await get(pathname, { access: "private", token, useCache: false });
    if (!result || result.statusCode !== 200 || result.stream === null) {
      throw new SignedPdfBlobError("not_found", "Signed PDF is not available.");
    }
    return await readWebStream(result.stream);
  } catch (err) {
    if (err instanceof SignedPdfBlobError) throw err;
    console.error("[signed-pdf-blob] get failed", sanitizeErrorForLog(err));
    throw new SignedPdfBlobError("not_found", "Signed PDF is not available.");
  }
}

/** Best-effort cleanup of a replaced blob. Never throws. */
export async function deleteSignedPdf(pathname: string): Promise<void> {
  const token = signedPdfBlobToken();
  if (!token || pathname.length === 0) return;
  try {
    await del(pathname, { token });
  } catch (err) {
    console.error("[signed-pdf-blob] delete failed", sanitizeErrorForLog(err));
  }
}
