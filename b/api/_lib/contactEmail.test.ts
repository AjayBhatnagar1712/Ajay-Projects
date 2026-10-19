import { describe, expect, it, vi } from "vitest";
import { sendContactFormEmail } from "./contactEmail.js";

describe("sendContactFormEmail", () => {
  it("escapes HTML in user-supplied message content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    process.env.RESEND_API_KEY = "test-key";

    await sendContactFormEmail({
      firstName: "Eve",
      lastName: "Evil",
      phone: "9876543210",
      email: "",
      role: "tenant",
      serviceTiming: "exploring",
      message: '<script>alert("xss")</script>',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { html: string };
    expect(body.html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(body.html).not.toContain("<script>");

    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
  });
});
