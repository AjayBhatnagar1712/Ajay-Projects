import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest } from "@vercel/node";
import {
  checkContactRateLimit,
  getContactClientIp,
  resetContactRateLimitStore,
} from "./contactRateLimit.js";

function mockRequest(forwarded?: string | string[]): VercelRequest {
  return {
    headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded },
  } as VercelRequest;
}

describe("getContactClientIp", () => {
  it("parses the first IP from a comma-separated x-forwarded-for list", () => {
    expect(getContactClientIp(mockRequest("1.2.3.4, 5.6.7.8"))).toBe("1.2.3.4");
  });

  it("uses the first header value when x-forwarded-for is an array", () => {
    expect(getContactClientIp(mockRequest(["9.9.9.9, 1.1.1.1", "ignored"]))).toBe("9.9.9.9");
  });

  it("falls back safely when the header is absent", () => {
    expect(getContactClientIp(mockRequest())).toBe("unknown");
  });
});

describe("checkContactRateLimit", () => {
  beforeEach(() => {
    resetContactRateLimitStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetContactRateLimitStore();
  });

  it("allows three requests then returns 429", () => {
    const ip = "203.0.113.10";
    expect(checkContactRateLimit(ip).ok).toBe(true);
    expect(checkContactRateLimit(ip).ok).toBe(true);
    expect(checkContactRateLimit(ip).ok).toBe(true);
    const blocked = checkContactRateLimit(ip);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.status).toBe(429);
    }
  });

  it("expires entries after the rolling window", () => {
    const ip = "203.0.113.11";
    expect(checkContactRateLimit(ip).ok).toBe(true);
    expect(checkContactRateLimit(ip).ok).toBe(true);
    expect(checkContactRateLimit(ip).ok).toBe(true);
    expect(checkContactRateLimit(ip).ok).toBe(false);

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    expect(checkContactRateLimit(ip).ok).toBe(true);
  });
});
