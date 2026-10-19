import * as FileSystem from "expo-file-system/legacy";
import { ApiError } from "@/lib/api/errors";
import { getAccessToken } from "@/lib/auth/secureSession";
import {
  NETWORK_TIMEOUT_MESSAGE,
  NETWORK_TIMEOUT_MS,
  withTimeout,
} from "@/lib/network/withTimeout";

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function apiBaseUrl(): string {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) {
    throw new Error("Missing EXPO_PUBLIC_API_URL. Copy apps/mobile/.env.example to .env");
  }
  return base.replace(/\/$/, "");
}

function bytesToBase64(bytes: Uint8Array): string {
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1] ?? 0;
    const byte3 = bytes[index + 2] ?? 0;
    const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

    output += BASE64_ALPHABET[(triplet >> 18) & 0x3f] ?? "";
    output += BASE64_ALPHABET[(triplet >> 12) & 0x3f] ?? "";
    output += index + 1 < bytes.length ? (BASE64_ALPHABET[(triplet >> 6) & 0x3f] ?? "") : "=";
    output += index + 2 < bytes.length ? (BASE64_ALPHABET[triplet & 0x3f] ?? "") : "=";
  }

  return output;
}

function normalizeErrorMessage(status: number, parsed: unknown): string {
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "error" in parsed &&
    typeof (parsed as { error: unknown }).error === "string"
  ) {
    return (parsed as { error: string }).error;
  }
  return `Request failed (${status})`;
}

function previewDirectoryUri(): string {
  if (!FileSystem.cacheDirectory) {
    throw new Error("PDF preview cache is unavailable on this device");
  }
  return `${FileSystem.cacheDirectory}lease-agreement-previews/`;
}

export type LeaseAgreementPreviewDocument = {
  fileUri: string;
  base64: string;
};

export function buildLeaseAgreementPreviewHtml(base64: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=3, user-scalable=yes"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      #status {
        padding: 16px;
        color: #666;
      }
      #viewer {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 0;
        width: 100%;
        box-sizing: border-box;
      }
      .page {
        background: white;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        display: block;
      }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  </head>
  <body>
    <div id="status">Rendering PDF preview…</div>
    <div id="viewer"></div>
    <script>
      const base64 = '${base64}';
      const statusEl = document.getElementById('status');
      const viewerEl = document.getElementById('viewer');

      function postMessage(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function decodeBase64(value) {
        const raw = atob(value);
        const bytes = new Uint8Array(raw.length);
        for (let index = 0; index < raw.length; index += 1) {
          bytes[index] = raw.charCodeAt(index);
        }
        return bytes;
      }

      function pageCssWidth() {
        const width = viewerEl.clientWidth || document.documentElement.clientWidth || window.innerWidth;
        return Math.max(280, Math.floor(width));
      }

      async function renderPdf() {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          const pdf = await pdfjsLib.getDocument({ data: decodeBase64(base64) }).promise;
          const cssWidth = pageCssWidth();
          const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 3);

          for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const baseViewport = page.getViewport({ scale: 1 });
            const fitScale = cssWidth / baseViewport.width;
            const renderViewport = page.getViewport({ scale: fitScale * pixelRatio });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = renderViewport.width;
            canvas.height = renderViewport.height;
            canvas.className = 'page';
            canvas.style.width = cssWidth + 'px';
            canvas.style.height = Math.floor(baseViewport.height * fitScale) + 'px';
            viewerEl.appendChild(canvas);
            await page.render({ canvasContext: context, viewport: renderViewport }).promise;
          }

          statusEl.style.display = 'none';
          postMessage({ type: 'ready', pageCount: pdf.numPages });
        } catch (error) {
          const message =
            error && typeof error === 'object' && 'message' in error
              ? error.message
              : 'Could not render the PDF preview.';
          statusEl.textContent = message;
          postMessage({ type: 'error', message });
        }
      }

      renderPdf();
    </script>
  </body>
</html>`;
}

export async function downloadLeaseAgreementPreviewPdf(
  agreementId: string,
): Promise<LeaseAgreementPreviewDocument> {
  return downloadLeaseAgreementPdf(
    `/v1/lease-agreements/${agreementId}/pdf`,
    agreementId,
    "preview",
  );
}

export async function downloadLeaseAgreementSignedPdf(
  agreementId: string,
): Promise<LeaseAgreementPreviewDocument> {
  return downloadLeaseAgreementPdf(
    `/v1/lease-agreements/${agreementId}/signed-pdf`,
    agreementId,
    "signed",
  );
}

async function downloadLeaseAgreementPdf(
  path: string,
  agreementId: string,
  kind: "preview" | "signed",
): Promise<LeaseAgreementPreviewDocument> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiError(401, "Not authenticated", null);
  }

  const response = await withTimeout(
    fetch(`${apiBaseUrl()}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        Authorization: `Bearer ${token}`,
      },
    }),
    NETWORK_TIMEOUT_MS,
    NETWORK_TIMEOUT_MESSAGE,
  );

  if (!response.ok) {
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }
    throw new ApiError(response.status, normalizeErrorMessage(response.status, parsed), parsed);
  }

  await FileSystem.makeDirectoryAsync(previewDirectoryUri(), { intermediates: true });

  const bytes = new Uint8Array(await response.arrayBuffer());
  const base64 = bytesToBase64(bytes);
  const fileUri = `${previewDirectoryUri()}${agreementId}-${kind}-${Date.now()}.pdf`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { fileUri, base64 };
}
