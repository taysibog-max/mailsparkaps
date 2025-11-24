const DEFAULT_APP_URL = 'https://mailsparkaps.vercel.app';

function normalizeBaseUrl(raw?: string | null): string {
  if (!raw) return '';
  return raw.trim().replace(/\/+$/, '');
}

export function resolveAppUrl(): string {
  const base =
    normalizeBaseUrl(process.env.APP_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    DEFAULT_APP_URL;
  return normalizeBaseUrl(base);
}

export function resolveShopifyRedirectUri(): string {
  const envRedirect = process.env.SHOPIFY_REDIRECT_URI;
  if (envRedirect && envRedirect.trim()) {
    return envRedirect.trim();
  }
  const baseUrl = resolveAppUrl();
  return baseUrl ? `${baseUrl}/api/shopify/callback` : '';
}

