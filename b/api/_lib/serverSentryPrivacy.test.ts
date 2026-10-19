import { describe, expect, it } from "vitest";
import {
  sanitizeServerSentryText,
  sanitizeServerSentryUrl,
  scrubServerSentryBreadcrumb,
  scrubServerSentryEvent,
} from "./serverSentryPrivacy";

const secrets = {
  account: "1234567890123456",
  email: "owner@example.com",
  jwt: "abcdefghij.klmnopqrst.uvwxyzABCD",
  pan: "ABCDE1234F",
  phone: "9876543210",
  token: "invite-token-value",
};

describe("server Sentry privacy filters", () => {
  it("removes query strings, credentials, and sensitive route values from URLs", () => {
    const url = `https://user:password@app.trustkeyper.com/api/tenant-document-upload/${secrets.token}?phone=${secrets.phone}#details`;
    const sanitized = sanitizeServerSentryUrl(url);

    expect(sanitized).toBe(
      "https://app.trustkeyper.com/api/tenant-document-upload/[REDACTED]",
    );
  });

  it("redacts common identity, payment, and authentication values from text", () => {
    const sanitized = sanitizeServerSentryText(
      `PAN ${secrets.pan}; phone=${secrets.phone}; account=${secrets.account}; email ${secrets.email}; Bearer ${secrets.jwt}`,
    );

    for (const secret of Object.values(secrets)) {
      if (secret !== secrets.token) {
        expect(sanitized).not.toContain(secret);
      }
    }
  });

  it("keeps only safe network breadcrumb fields and drops UI breadcrumbs", () => {
    expect(
      scrubServerSentryBreadcrumb({
        category: "ui.click",
        message: `Clicked by ${secrets.email}`,
      }),
    ).toBeNull();

    expect(
      scrubServerSentryBreadcrumb({
        category: "fetch",
        data: {
          method: "POST",
          request_body: { phone: secrets.phone },
          status_code: 201,
          url: `https://app.trustkeyper.com/api/sync/accounts/${secrets.phone}?token=${secrets.token}`,
        },
      }),
    ).toEqual({
      category: "fetch",
      data: {
        method: "POST",
        status_code: 201,
        url: "https://app.trustkeyper.com/api/sync/accounts/[REDACTED]",
      },
    });
  });

  it("removes PII and arbitrary event payloads before sending", () => {
    const scrubbed = scrubServerSentryEvent({
      message: `Signup failed for ${secrets.email}`,
      user: { email: secrets.email, id: secrets.phone },
      extra: { account: secrets.account },
      request: {
        data: { pan: secrets.pan },
        headers: { authorization: `Bearer ${secrets.jwt}` },
        method: "POST",
        url: `https://app.trustkeyper.com/api/broker-tenant-onboard/${secrets.token}?phone=${secrets.phone}`,
      },
      breadcrumbs: [
        {
          category: "fetch",
          data: {
            method: "POST",
            request_body: secrets.account,
            url: `https://app.trustkeyper.com/api/v1/review/${secrets.token}`,
          },
        },
      ],
      exception: {
        values: [{ type: "Error", value: `Invalid PAN ${secrets.pan}` }],
      },
    });

    const serialized = JSON.stringify(scrubbed);
    for (const secret of Object.values(secrets)) {
      expect(serialized).not.toContain(secret);
    }
    expect(scrubbed.request).toEqual({
      method: "POST",
      url: "https://app.trustkeyper.com/api/broker-tenant-onboard/[REDACTED]",
    });
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
  });
});
