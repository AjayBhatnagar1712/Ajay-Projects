import { readFile } from "node:fs/promises";
import { put } from "@vercel/blob";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import { json } from "./_lib/http.js";
import { sanitizeErrorForLog } from "./_lib/sanitizeErrorForLog.js";
import {
  captureAndFlushApiError,
  withSentryVercelHandler,
} from "./_lib/serverSentry.js";
import { assertSyncAccountAuth } from "./_lib/syncAuth.js";

const MAX_BYTES = 2 * 1024 * 1024;

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function fieldValue(
  fields: formidable.Fields,
  name: string,
): string | undefined {
  const raw = fields[name];
  if (Array.isArray(raw)) return raw[0];
  if (typeof raw === "string") return raw;
  return undefined;
}

function fileValue(
  files: formidable.Files,
  name: string,
): formidable.File | undefined {
  const raw = files[name];
  if (Array.isArray(raw)) return raw[0];
  if (raw && typeof raw === "object" && "filepath" in raw) return raw;
  return undefined;
}

function isMaxFileSizeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as Error & { code?: number }).code;
  return code === 1009 || /maxFileSize|max file size/i.test(err.message);
}

/** Accepts a property image upload and stores it in Vercel Blob. */
async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  let fields: formidable.Fields;
  let files: formidable.Files;

  try {
    const form = formidable({
      maxFileSize: MAX_BYTES,
      multiples: false,
      filter: ({ mimetype }) => Boolean(mimetype?.startsWith("image/")),
    });
    // @vercel/node pre-buffers the body and replays it on req.on("data"); formidable listens on that stream.
    [fields, files] = await form.parse(req);
  } catch (err) {
    if (isMaxFileSizeError(err)) {
      json(res, 400, { error: "Image too large — max 2MB" });
      return;
    }
    console.error(
      "[upload-property-image] formidable parse failed:",
      sanitizeErrorForLog(err),
    );
    json(res, 400, { error: "Invalid form data" });
    return;
  }

  const phone = fieldValue(fields, "phone");
  if (!phone) {
    json(res, 400, { error: "Phone is required" });
    return;
  }

  const auth = await assertSyncAccountAuth(
    headerValue(req.headers.authorization),
    phone,
  );
  if (!auth.ok) {
    json(res, auth.status, { error: auth.error });
    return;
  }

  const image = fileValue(files, "image");
  if (!image?.filepath) {
    json(res, 400, { error: "Image file is required" });
    return;
  }

  const fileSize = image.size ?? 0;
  if (fileSize > MAX_BYTES) {
    json(res, 400, { error: "Image too large — max 2MB" });
    return;
  }

  const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
  const random = Math.random().toString(36).slice(2, 10);
  const pathname = `property-images/${normalizedPhone}/${Date.now()}-${random}.jpg`;

  try {
    const buffer = await readFile(image.filepath);
    if (buffer.length > MAX_BYTES) {
      json(res, 400, { error: "Image too large — max 2MB" });
      return;
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error("[upload-property-image] BLOB_READ_WRITE_TOKEN not set");
      json(res, 502, { error: "Image upload failed" });
      return;
    }

    const result = await put(pathname, buffer, {
      access: "public",
      contentType: "image/jpeg",
      token,
    });

    json(res, 200, { url: result.url });
  } catch (err) {
    await captureAndFlushApiError(err, {
      method: req.method,
      route: "/api/upload-property-image",
      runtime: "vercel-function",
      url: req.url,
    });
    console.error(
      "[upload-property-image] blob put failed:",
      sanitizeErrorForLog(err),
    );
    json(res, 502, { error: "Image upload failed" });
  }
}

export default withSentryVercelHandler(handler, {
  route: "/api/upload-property-image",
  runtime: "vercel-function",
});
