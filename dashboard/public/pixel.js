'use strict';

(function MailSparkPixel() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__MAILSPARK_PIXEL_INITIALIZED__) return;

  const host = String(window.location?.hostname || '').toLowerCase();
  const SHOPIFY_HOST_PATTERNS = [/\.myshopify\.com$/, /checkout\.shopify\.com$/, /shopifypreview\.com$/];
  const isShopifyCheckout =
    SHOPIFY_HOST_PATTERNS.some((regex) => regex.test(host)) ||
    Boolean(window.ShopifyCheckout || window.Shopify?.Checkout);
  if (!isShopifyCheckout) return;

  window.__MAILSPARK_PIXEL_INITIALIZED__ = true;

  const scriptEl =
    document.currentScript ||
    document.querySelector('script[data-mailspark-pixel]') ||
    Array.from(document.getElementsByTagName('script')).find((el) => /pixel\.js/i.test(el.src || ''));
  const endpointOverride = scriptEl?.getAttribute('data-endpoint') || scriptEl?.dataset?.endpoint;
  const scriptUrl = (() => {
    try {
      return scriptEl?.src ? new URL(scriptEl.src) : null;
    } catch (_) {
      return null;
    }
  })();
  const baseUrl = endpointOverride
    ? endpointOverride.replace(/\/api\/pixel.*/i, '')
    : scriptUrl
    ? `${scriptUrl.protocol}//${scriptUrl.host}`
    : '';
  const pixelEndpoint = endpointOverride || `${baseUrl}/api/pixel`;

  const state = {
    email: null,
    token: null,
    sentAt: {},
  };

  const shopDomain =
    window.Shopify?.shop ||
    window.ShopifyCheckout?.shop ||
    window.__st?.domain ||
    host.replace(/^www\./, '');

  function readEmailFromDom() {
    const selectors = [
      'input[name="checkout[email]"]',
      'input[name="email"]',
      'input[type="email"]',
      '[data-email]',
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && typeof el.value === 'string' && el.value.includes('@')) {
        return el.value.trim();
      }
    }
    return null;
  }

  function readTokenFromDom() {
    const candidates = [
      window.ShopifyCheckout?.token,
      window.Shopify?.Checkout?.token,
      window.__st?.cid,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    const inputs = [
      'input[name="checkout[token]"]',
      'input[name="checkout_token"]',
      'input[name="token"]',
    ];
    for (const selector of inputs) {
      const el = document.querySelector(selector);
      if (el && el.value) return el.value.trim();
    }
    return null;
  }

  function updateState(partial) {
    if (!partial) return;
    if (partial.email && typeof partial.email === 'string') {
      state.email = partial.email.trim();
    } else if (!state.email) {
      const domEmail = readEmailFromDom();
      if (domEmail) state.email = domEmail;
    }
    if (partial.token && typeof partial.token === 'string') {
      state.token = partial.token.trim();
    } else if (!state.token) {
      const domToken = readTokenFromDom();
      if (domToken) state.token = domToken;
    }
  }

  function extractCheckoutInfo(payload) {
    const data = payload?.data || payload || {};
    const checkout = data.checkout || data.checkoutData || data;
    const customer = checkout.customer || data.customer;
    return {
      email:
        checkout?.email ||
        checkout?.contact_email ||
        customer?.email ||
        data.email ||
        readEmailFromDom(),
      token: checkout?.token || checkout?.id || checkout?.checkoutToken || readTokenFromDom(),
    };
  }

  function canSend(type) {
    const now = Date.now();
    const last = state.sentAt[type] || 0;
    if (now - last < 500) return false;
    state.sentAt[type] = now;
    return true;
  }

  function sendPixel(type) {
    if (!canSend(type)) return;
    if (!state.token) {
      const fallbackToken = readTokenFromDom();
      if (fallbackToken) state.token = fallbackToken;
    }
    if (!state.token) return;

    const payload = {
      type,
      email: state.email || readEmailFromDom(),
      token: state.token,
      timestamp: Date.now(),
      shopDomain,
    };

    try {
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(pixelEndpoint, blob);
      if (!ok && typeof fetch === 'function') {
        fetch(pixelEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
          mode: 'cors',
          credentials: 'omit',
        }).catch(() => {});
      }
    } catch (error) {
      console.warn('[MailSpark Pixel] Failed to send beacon', error);
    }
  }

  function subscribeAnalytics() {
    const analytics = window.analytics;
    if (!analytics || typeof analytics.subscribe !== 'function') return false;
    analytics.subscribe('checkout_started', (payload) => {
      updateState(extractCheckoutInfo(payload));
      sendPixel('checkout_progress');
    });
    analytics.subscribe('checkout_contact_information_submitted', (payload) => {
      updateState(extractCheckoutInfo(payload));
      sendPixel('checkout_progress');
    });
    return true;
  }

  function waitForAnalytics(attempts) {
    if (subscribeAnalytics()) return;
    if (attempts <= 0) return;
    setTimeout(() => waitForAnalytics(attempts - 1), 500);
  }

  waitForAnalytics(40);

  window.addEventListener(
    'beforeunload',
    () => {
      sendPixel('checkout_unload');
    },
    { capture: true },
  );

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendPixel('checkout_soft_abandon');
    }
  });
})();


