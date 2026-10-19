/**
 * Build-time injection of Google Tag Manager snippets for production marketing deploys.
 */
import type { Plugin } from "vite";

const GTM_HEAD_SCRIPT = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-T679X9X7');</script>
<!-- End Google Tag Manager -->`;

const GTM_BODY_NOSCRIPT = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-T679X9X7"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

const HEAD_OPEN_TAG = /<head\b[^>]*>/i;
const BODY_OPEN_TAG = /<body\b[^>]*>/i;

export function isMarketingAnalyticsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VITE_ENABLE_ANALYTICS === "1";
}

export function injectMarketingAnalytics(html: string): string {
  if (!HEAD_OPEN_TAG.test(html)) {
    throw new Error("injectMarketingAnalytics: <head> not found");
  }
  if (!BODY_OPEN_TAG.test(html)) {
    throw new Error("injectMarketingAnalytics: <body> not found");
  }

  const next = html
    .replace(HEAD_OPEN_TAG, (match) => `${match}\n    ${GTM_HEAD_SCRIPT}`)
    .replace(BODY_OPEN_TAG, (match) => `${match}\n    ${GTM_BODY_NOSCRIPT}`);

  return next;
}

export function marketingAnalyticsPlugin(
  isEnabled: () => boolean = () => isMarketingAnalyticsEnabled(),
): Plugin {
  return {
    name: "marketing-analytics",
    transformIndexHtml(html) {
      if (!isEnabled()) {
        return html;
      }
      return injectMarketingAnalytics(html);
    },
  };
}
