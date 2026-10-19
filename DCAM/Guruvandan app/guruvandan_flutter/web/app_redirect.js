(function () {
  const userAgent = navigator.userAgent || '';
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSearchCrawler =
    /bot|crawler|spider|crawling|google-inspectiontool|googleother|bingpreview/i
      .test(userAgent);
  const isStandalone = window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches;

  if ((!isAndroid && !isIOS) || isSearchCrawler || isStandalone || navigator.webdriver) {
    return;
  }

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const quoteIndex = pathParts.indexOf('quote');
  const quoteId = quoteIndex >= 0 ? pathParts[quoteIndex + 1] : null;
  const isHome = pathParts.length === 0;
  // Installed apps already receive verified quote links through Android App
  // Links and iOS Universal Links. Keep the browser fallback on the bilingual
  // quote page so visitors without the app can read it before choosing a store.
  if (quoteId) return;
  if (!isHome && !quoteId) return;

  const handoffKey = 'guru-vandan-mobile-handoff';
  if (sessionStorage.getItem(handoffKey)) return;
  sessionStorage.setItem(handoffKey, 'attempted');

  const appTarget = quoteId ? `quote/${quoteId}` : 'home';
  const deepLink = `guruvandan://${appTarget}`;
  const androidStore =
    'https://play.google.com/store/apps/details?id=com.ivar.guruvandan';
  const iosStore = 'https://apps.apple.com/app/id6807657972';

  if (isAndroid) {
    const fallback = encodeURIComponent(androidStore);
    window.location.href =
      `intent://${appTarget}#Intent;scheme=guruvandan;` +
      `package=com.ivar.guruvandan;S.browser_fallback_url=${fallback};end`;
    return;
  }

  let storeTimer = window.setTimeout(function () {
    if (document.visibilityState === 'visible') window.location.href = iosStore;
  }, 1400);

  const cancelStoreRedirect = function () {
    if (document.visibilityState === 'hidden' && storeTimer) {
      window.clearTimeout(storeTimer);
      storeTimer = null;
    }
  };

  document.addEventListener('visibilitychange', cancelStoreRedirect, { once: true });
  window.addEventListener('pagehide', cancelStoreRedirect, { once: true });
  window.location.href = deepLink;
})();
