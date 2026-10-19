import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleContactRequest } from "./contactHandler.js";
import { resetContactRateLimitStore } from "./contactRateLimit.js";

const sendContactFormEmail = vi.fn();

vi.mock("./contactEmail.js", () => ({
  sendContactFormEmail: (...args: unknown[]) => sendContactFormEmail(...args),
}));

function createMockResponse() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
      return res;
    },
    end(payload?: string) {
      body = payload ?? "";
    },
  };

  return {
    res: res as unknown as VercelResponse,
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get body() {
      return body;
    },
  };
}

const validBody = {
  firstName: "Asha",
  lastName: "Sharma",
  phone: "9876543210",
  email: "asha@example.com",
  role: "property_owner",
  serviceTiming: "within_1_month",
  message: "Hello",
};

function contactRequest(
  options: {
    method?: string;
    origin?: string;
    body?: unknown;
    forwardedFor?: string;
  } = {},
): VercelRequest {
  return {
    method: options.method ?? "POST",
    headers: {
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.forwardedFor ? { "x-forwarded-for": options.forwardedFor } : {}),
    },
    body: options.body,
  } as unknown as VercelRequest;
}

describe("handleContactRequest", () => {
  beforeEach(() => {
    sendContactFormEmail.mockReset();
    sendContactFormEmail.mockResolvedValue(true);
    resetContactRateLimitStore();
  });

  afterEach(() => {
    resetContactRateLimitStore();
  });

  it("returns 200 for honeypot submissions without sending email", async () => {
    const mock = createMockResponse();
    await handleContactRequest(
      contactRequest({
        origin: "https://trustkeyper.com",
        body: { ...validBody, website: "https://bot.test" },
        forwardedFor: "198.51.100.7",
      }),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(JSON.parse(mock.body)).toEqual({ ok: true });
    expect(sendContactFormEmail).not.toHaveBeenCalled();
  });

  it("returns 429 on the fourth request from the same IP", async () => {
    const ip = "198.51.100.8";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const okResponse = createMockResponse();
      await handleContactRequest(
        contactRequest({ origin: "https://trustkeyper.com", body: validBody, forwardedFor: ip }),
        okResponse.res,
      );
      expect(okResponse.statusCode).toBe(200);
    }

    const blocked = createMockResponse();
    await handleContactRequest(
      contactRequest({ origin: "https://trustkeyper.com", body: validBody, forwardedFor: ip }),
      blocked.res,
    );

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers["Access-Control-Allow-Origin"]).toBe("https://trustkeyper.com");
    expect(sendContactFormEmail).toHaveBeenCalledTimes(3);
  });

  it("attaches CORS headers on validation errors for allowed origins", async () => {
    const mock = createMockResponse();
    await handleContactRequest(
      contactRequest({
        origin: "http://localhost:5174",
        body: { ...validBody, phone: "123" },
      }),
      mock.res,
    );

    expect(mock.statusCode).toBe(400);
    expect(mock.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5174");
    expect(mock.headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
  });

  it("omits CORS headers for disallowed origins", async () => {
    const mock = createMockResponse();
    await handleContactRequest(
      contactRequest({
        origin: "https://evil.example.com",
        body: validBody,
      }),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(mock.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("handles OPTIONS preflight for allowed origins", async () => {
    const mock = createMockResponse();
    await handleContactRequest(
      contactRequest({ method: "OPTIONS", origin: "https://trustkeyper.com" }),
      mock.res,
    );

    expect(mock.statusCode).toBe(204);
    expect(mock.headers["Access-Control-Allow-Origin"]).toBe("https://trustkeyper.com");
    expect(mock.headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
  });
});
