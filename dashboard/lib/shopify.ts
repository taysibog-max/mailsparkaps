import crypto from 'crypto';
import { encryptToken, decryptToken, signState } from './crypto';

export type ShopifyWebhookTopic =
  | 'checkouts/create'
  | 'checkouts/update'
  | 'carts/update'
  | 'orders/create'
  | 'customers/create';

export const DEFAULT_SCOPES: string[] = (() => {
  const envScopes = process.env.SHOPIFY_SCOPES;
  if (envScopes && envScopes.trim()) return envScopes.split(',').map(s => s.trim());
  return ['read_orders', 'read_customers', 'read_checkouts', 'read_products'];
})();

export function normalizeShopDomain(input: string): string {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '');
  if (!s.includes('.')) s = `${s}.myshopify.com`;
  return s;
}

export function buildAuthUrl(shop: string, uid: string) {
  const normalized = normalizeShopDomain(shop);
  const redirectFromEnv =
    process.env.SHOPIFY_REDIRECT_URL ||
    undefined;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const redirectUri = redirectFromEnv || (base ? `${base}/dashboard/api/shopify/callback` : '');
  if (!redirectUri) throw new Error('SHOPIFY_REDIRECT_URL/APP_URL not configured');
  const stateRaw = `${uid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const stateSig = signState(stateRaw);
  const state = Buffer.from(`${stateRaw}:${stateSig}`, 'utf8').toString('base64');
  const clientId = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || '';
  const scopes = DEFAULT_SCOPES.join(',');
  const url =
    `https://${normalized}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;
  return { url, redirectUri, normalizedShop: normalized, state };
}

export function verifyState(stateB64: string): string | null {
  try {
    const raw = Buffer.from(stateB64, 'base64').toString('utf8');
    const [uid, ts, nonce, sig] = raw.split(':');
    const secret = process.env.SHOPIFY_STATE_SECRET || '';
    const check = crypto.createHmac('sha256', secret).update(`${uid}:${ts}:${nonce}`, 'utf8').digest('hex');
    if (check !== sig) return null;
    return uid;
  } catch {
    return null;
  }
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<string> {
  const endpoint = `https://${shop}/admin/oauth/access_token`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return String(data.access_token || '');
}

export function verifyOAuthHmac(query: Record<string, any>): boolean {
  const secret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || '';
  if (!secret) return false;
  // Build message from sorted query excluding hmac and signature
  const entries = Object.entries(query)
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`);
  const message = entries.join('&');
  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const received = String(query.hmac || '');
  // Compare hex to hex; Shopify sends hmac hex in OAuth
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(received, 'utf8'));
  } catch {
    return digest === received;
  }
}

export function verifyShopifyWebhook(rawBody: Buffer, hmacHeader?: string | string[]): boolean {
  const secret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || '';
  if (!secret || !hmacHeader) return false;
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const received = Array.isArray(hmacHeader) ? hmacHeader[0] : hmacHeader;
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(received || '', 'utf8'));
  } catch {
    return hmac === received;
  }
}

export function encryptAccessToken(token: string) {
  return encryptToken(token);
}
export function decryptAccessToken(enc: string) {
  return decryptToken(enc);
}


