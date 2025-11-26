const DEFAULT_APP_URL = 'https://mailsparkaps.vercel.app';

function normalizeBaseUrl(raw?: string | null): string {
  if (!raw) return '';
  return raw.trim().replace(/\/+$/, '');
}

function resolveAppUrl(): string {
  const base =
    normalizeBaseUrl(process.env.APP_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    DEFAULT_APP_URL;
  return normalizeBaseUrl(base);
}

function resolveShopifyRedirectUri(): string {
  return (process.env.SHOPIFY_REDIRECT_URI || '').trim();
}

export function getShopifyConfig() {
  const appUrl = resolveAppUrl();
  const redirectUri = resolveShopifyRedirectUri();

  return {
    appUrl,
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    scopes: process.env.SHOPIFY_SCOPES || '',
    redirectUri,
  };
}

export { resolveAppUrl, resolveShopifyRedirectUri };

