import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const getRolesForPhone = vi.fn();
const getAccountSummariesForPhone = vi.fn();
const setAccountDataKey = vi.fn();

vi.mock("./vercelSyncDb.js", () => ({
  usePostgres: () => false,
}));

vi.mock("@workspace/sync-store", () => ({
  normalizePhone: (phone: string) => phone.replace(/\D/g, "").slice(-10),
  getRolesForPhone,
  getAccountSummariesForPhone,
  setAccountDataKey,
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

function syncRequest(
  segments: string[],
  options: {
    method?: string;
    origin?: string;
    authorization?: string;
    body?: unknown;
  } = {},
): VercelRequest {
  return {
    method: options.method ?? "GET",
    headers: {
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.authorization ? { authorization: options.authorization } : {}),
    },
    query: { syncPath: segments.join("/") },
    body: options.body,
  } as unknown as VercelRequest;
}

describe("handleSyncRequest marketing CORS", () => {
  beforeEach(() => {
    process.env.SYNC_AUTH_DISABLED = "1";
    getRolesForPhone.mockReset();
    getAccountSummariesForPhone.mockReset();
    setAccountDataKey.mockReset();
    getRolesForPhone.mockResolvedValue(["owner"]);
    getAccountSummariesForPhone.mockResolvedValue([{ role: "owner", displayName: "Owner" }]);
    setAccountDataKey.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.SYNC_AUTH_DISABLED;
    delete process.env.MARKETING_STAGING_ORIGIN;
  });

  it("adds CORS headers for allowed origins on roles lookup", async () => {
    const { handleSyncRequest } = await import("./syncHandler.js");
    const mock = createMockResponse();

    await handleSyncRequest(
      syncRequest(["accounts", "9876543210", "roles"], {
        origin: "https://trustkeyper.com",
      }),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(mock.headers["Access-Control-Allow-Origin"]).toBe("https://trustkeyper.com");
    expect(mock.headers["Access-Control-Allow-Methods"]).toBe("GET");
  });

  it("omits CORS headers for disallowed origins on summaries lookup", async () => {
    const { handleSyncRequest } = await import("./syncHandler.js");
    const mock = createMockResponse();

    await handleSyncRequest(
      syncRequest(["accounts", "9876543210", "summaries"], {
        origin: "https://app.trustkeyper.com",
      }),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(mock.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("handles profile PUT preflight for allowed origins", async () => {
    const { handleSyncRequest } = await import("./syncHandler.js");
    const mock = createMockResponse();

    await handleSyncRequest(
      syncRequest(["accounts", "9876543210", "owner", "profile"], {
        method: "OPTIONS",
        origin: "http://localhost:5174",
      }),
      mock.res,
    );

    expect(mock.statusCode).toBe(204);
    expect(mock.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5174");
    expect(mock.headers["Access-Control-Allow-Methods"]).toBe("PUT, OPTIONS");
    expect(setAccountDataKey).not.toHaveBeenCalled();
  });

  it("adds CORS headers on profile PUT responses for allowed origins", async () => {
    const { handleSyncRequest } = await import("./syncHandler.js");
    const mock = createMockResponse();

    await handleSyncRequest(
      syncRequest(["accounts", "9876543210", "owner", "profile"], {
        method: "PUT",
        origin: "https://trustkeyper.com",
        authorization: "Bearer test-token",
        body: { value: JSON.stringify({ name: "Owner", phone: "9876543210" }) },
      }),
      mock.res,
    );

    expect(mock.statusCode).toBe(200);
    expect(mock.headers["Access-Control-Allow-Origin"]).toBe("https://trustkeyper.com");
    expect(setAccountDataKey).toHaveBeenCalled();
  });

  it("does not add CORS headers on non-marketing sync routes", async () => {
    const { handleSyncRequest } = await import("./syncHandler.js");
    const mock = createMockResponse();

    await handleSyncRequest(
      syncRequest(["accounts", "9876543210", "owner", "settings"], {
        method: "PUT",
        origin: "https://trustkeyper.com",
        authorization: "Bearer test-token",
        body: { value: "x" },
      }),
      mock.res,
    );

    expect(mock.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
