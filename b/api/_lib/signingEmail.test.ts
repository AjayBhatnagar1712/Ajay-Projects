import { afterEach, describe, expect, it, vi } from "vitest";
import { sendSigningNotificationEmail } from "./signingEmail.js";

describe("sendSigningNotificationEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.SIGNING_NOTIFY_EMAIL;
    delete process.env.SIGNING_FROM_EMAIL;
  });

  it("escapes HTML in the property address and agreement id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    process.env.RESEND_API_KEY = "test-key";
    process.env.SIGNING_NOTIFY_EMAIL = "aman@example.com";

    const sent = await sendSigningNotificationEmail({
      agreementId: "id-<script>",
      propertyAddress: '12 MG Road</a><script>alert(1)</script>',
      adminUrl: "https://app.trustkeyper.com/admin/agreements/abc",
    });

    expect(sent).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      to: string[];
      html: string;
    };
    expect(body.to).toEqual(["aman@example.com"]);
    expect(body.html).toContain("12 MG Road&lt;/a&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(body.html).toContain("id-&lt;script&gt;");
    expect(body.html).not.toContain("<script>");
    expect(body.html).toContain("https://app.trustkeyper.com/admin/agreements/abc");
  });

  it("returns false when Resend is not configured, without throwing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sent = await sendSigningNotificationEmail({
      agreementId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      propertyAddress: "1 Main Road",
      adminUrl: "https://app.trustkeyper.com/admin/agreements/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
