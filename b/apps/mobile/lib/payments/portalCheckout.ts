/**
 * Portal Razorpay WebView checkout helpers.
 *
 * "Pay Now" was previously our own HTML button before rzp.open() — not a
 * Razorpay confirmation step. Checkout must auto-open and announce success
 * to React Native via postMessage so the native screen can close the WebView.
 */

export type CheckoutMessage =
  | { type: "success"; paymentId?: string; orderId?: string }
  | { type: "failure"; reason?: string }
  | { type: "dismiss" }
  | { type: "ready" };

const WEBVIEW_SCHEMES = new Set(["http:", "https:", "about:", "data:", "blob:"]);

export function checkoutNavigationScheme(rawUrl: string): string {
  try {
    return new URL(rawUrl).protocol.toLowerCase();
  } catch {
    return "unknown:";
  }
}

export function isCheckoutWebViewUrl(rawUrl: string): boolean {
  return WEBVIEW_SCHEMES.has(checkoutNavigationScheme(rawUrl));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseCheckoutMessage(raw: string): CheckoutMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      return null;
    }

    if (parsed.type === "success") {
      return {
        type: "success",
        paymentId:
          typeof parsed.paymentId === "string" ? parsed.paymentId : undefined,
        orderId: typeof parsed.orderId === "string" ? parsed.orderId : undefined,
      };
    }
    if (parsed.type === "failure") {
      return {
        type: "failure",
        reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      };
    }
    if (parsed.type === "dismiss") {
      return { type: "dismiss" };
    }
    if (parsed.type === "ready") {
      return { type: "ready" };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Loads Checkout.js and opens the Razorpay modal immediately (no intermediate
 * "Pay now" button). On success, posts to React Native repeatedly and replaces
 * the page body so the user is never stranded on Razorpay's checkmark overlay.
 */
export function buildCheckoutHtml(input: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  description: string;
}): string {
  const keyId = JSON.stringify(input.keyId);
  const orderId = JSON.stringify(input.orderId);
  const amount = JSON.stringify(input.amountPaise);
  const description = JSON.stringify(input.description);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #111;
    }
    #boot {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 24px;
      text-align: center;
      box-sizing: border-box;
    }
    #done {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 24px;
      text-align: center;
      box-sizing: border-box;
      gap: 12px;
    }
  </style>
</head>
<body>
  <div id="boot"><p>Opening secure checkout…</p></div>
  <div id="done">
    <p style="font-size:18px;font-weight:600;margin:0">Payment successful</p>
    <p style="margin:0;color:#555">Returning to TrustKeyper…</p>
  </div>
  <script>
    function post(payload) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      } catch (e) {}
    }

    var successPayload = null;
    var successTimer = null;

    function announceSuccess(response) {
      successPayload = {
        type: "success",
        paymentId: response && response.razorpay_payment_id
          ? response.razorpay_payment_id
          : undefined,
        orderId: ${orderId}
      };
      post(successPayload);
      var boot = document.getElementById("boot");
      var done = document.getElementById("done");
      if (boot) boot.style.display = "none";
      if (done) done.style.display = "flex";
      if (successTimer) clearInterval(successTimer);
      successTimer = setInterval(function () {
        if (successPayload) post(successPayload);
      }, 400);
    }

    function openCheckout() {
      if (typeof Razorpay !== "function") {
        post({ type: "failure", reason: "Razorpay checkout failed to load" });
        return;
      }
      try {
        var rzp = new Razorpay({
          key: ${keyId},
          amount: ${amount},
          currency: "INR",
          name: "TrustKeyper",
          description: ${description},
          order_id: ${orderId},
          webview_intent: true,
          theme: { color: "#0B57D0" },
          handler: function (response) {
            announceSuccess(response);
          },
          modal: {
            ondismiss: function () {
              if (!successPayload) {
                post({ type: "dismiss" });
              }
            }
          }
        });
        rzp.on("payment.failed", function (response) {
          var reason =
            response && response.error && response.error.description
              ? response.error.description
              : "Payment failed";
          post({ type: "failure", reason: reason });
        });
        post({ type: "ready" });
        rzp.open();
      } catch (err) {
        post({ type: "failure", reason: String(err) });
      }
    }

    if (document.readyState === "complete") {
      openCheckout();
    } else {
      window.addEventListener("load", openCheckout);
    }
  </script>
</body>
</html>`;
}
