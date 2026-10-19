export type SanitizedErrorLog = {
  message: string;
  code?: string;
};

/**
 * Log-safe error fields only — never metadata, nested Razorpay payloads,
 * or JSON/stringified object dumps.
 */
export function sanitizeErrorForLog(err: unknown): SanitizedErrorLog {
  if (err === null) return { message: "null" };
  if (err === undefined) return { message: "undefined" };

  let message: string | undefined;
  let code: string | undefined;

  if (typeof err === "object") {
    const record = err as Record<string, unknown>;
    const nested = record.error;
    if (typeof nested === "object" && nested !== null) {
      const razorpay = nested as Record<string, unknown>;
      if (typeof razorpay.code === "string") code = razorpay.code;
      if (typeof razorpay.description === "string") message = razorpay.description;
    }
    if (code === undefined && typeof record.code === "string") code = record.code;
    if (message === undefined && err instanceof Error) message = err.message;
    // Never String(object) / JSON.stringify — custom toString or payloads can leak.
    if (message === undefined) message = "Unknown error";
  } else if (typeof err === "string") {
    message = err;
  } else if (typeof err === "number" || typeof err === "boolean" || typeof err === "bigint") {
    message = String(err);
  } else {
    message = "Unknown error";
  }

  return code ? { message, code } : { message };
}
