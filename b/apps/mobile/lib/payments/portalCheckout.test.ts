import { describe, expect, it } from "vitest";
import {
  buildCheckoutHtml,
  checkoutNavigationScheme,
  isCheckoutWebViewUrl,
  parseCheckoutMessage,
} from "./portalCheckout";

describe("parseCheckoutMessage", () => {
  it("parses success with payment and order ids", () => {
    expect(
      parseCheckoutMessage(
        JSON.stringify({
          type: "success",
          paymentId: "pay_abc",
          orderId: "order_xyz",
        }),
      ),
    ).toEqual({
      type: "success",
      paymentId: "pay_abc",
      orderId: "order_xyz",
    });
  });

  it("parses failure, dismiss, and ready", () => {
    expect(parseCheckoutMessage('{"type":"failure","reason":"declined"}')).toEqual({
      type: "failure",
      reason: "declined",
    });
    expect(parseCheckoutMessage('{"type":"dismiss"}')).toEqual({ type: "dismiss" });
    expect(parseCheckoutMessage('{"type":"ready"}')).toEqual({ type: "ready" });
  });

  it("returns null for invalid payloads", () => {
    expect(parseCheckoutMessage("not-json")).toBeNull();
    expect(parseCheckoutMessage('{"type":"unknown"}')).toBeNull();
    expect(parseCheckoutMessage("null")).toBeNull();
  });
});

describe("buildCheckoutHtml", () => {
  const html = buildCheckoutHtml({
    keyId: "rzp_test_key",
    orderId: "order_test_1",
    amountPaise: 600,
    description: "Consultancy fee",
  });

  it("does not render an intermediate Pay Now confirmation button", () => {
    expect(html).not.toMatch(/Pay\s*Now/i);
    expect(html).not.toMatch(/<button/i);
  });

  it("auto-opens Razorpay checkout on load", () => {
    expect(html).toContain("rzp.open()");
    expect(html).toContain('window.addEventListener("load", openCheckout)');
    expect(html).toContain("Opening secure checkout");
    expect(html).toContain("webview_intent: true");
  });

  it("announces success to React Native and shows a return hint", () => {
    expect(html).toContain("announceSuccess");
    expect(html).toContain("ReactNativeWebView");
    expect(html).toContain('type: "success"');
    expect(html).toContain("Returning to TrustKeyper");
    expect(html).toContain("order_test_1");
    expect(html).toContain("600");
  });

  it("keeps web URLs inside the WebView and identifies external schemes", () => {
    expect(isCheckoutWebViewUrl("https://api.razorpay.com/pay")).toBe(true);
    expect(isCheckoutWebViewUrl("about:blank")).toBe(true);
    expect(isCheckoutWebViewUrl("upi://pay?pa=test@upi")).toBe(false);
    expect(isCheckoutWebViewUrl("intent://pay#Intent;scheme=upi;end")).toBe(false);
    expect(checkoutNavigationScheme("upi://pay")).toBe("upi:");
  });
});
