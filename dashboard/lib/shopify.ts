import crypto from 'crypto';
import { encryptToken, decryptToken, signState } from './crypto';

export type ShopifyWebhookTopic =
  | 'checkouts/create'
  | 'checkouts/update'
  | 'carts/update'
  | 'orders/create'
  | 'customers/create';

export const DEFAULT_SCOPES: string[] = [
  'read_orders',
  'read_customers',
  'read_checkouts',
  'read_products',
];

export function normalizeShopDomain(input: string): string {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '');
  if (!s.includes('.')) s = `${s}.myshopify.com`;
  return s;
}

export function buildAuthUrl(shop: string, uid: string) {
  const normalized = normalizeShopDomain(shop);
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!base) throw new Error('APP_URL is not configured');
  const redirectUri = `${base}/api/shopify/callback`;
  const stateRaw = `${uid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const stateSig = signState(stateRaw);
  const state = Buffer.from(`${stateRaw}:${stateSig}`, 'utf8').toString('base64');
  const url =
    `https://${normalized}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(process.env.SHOPIFY_API_KEY || '')}` +
    `&scope=${encodeURIComponent(DEFAULT_SCOPES.join(','))}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;
  return { url, redirectUri, normalizedShop: normalized, state };
}

export function verifyState(stateB64: string): string | null {
  try {
    const raw = Buffer.from(stateB64, 'base64').toString('utf8');
    const [uid, ts, nonce, sig] = raw.split(':');
    const secret = process.env.SHOPIFY_OAUTH_STATE_SECRET || process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY || '';
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
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return String(data.access_token || '');
}

export function verifyShopifyWebhook(rawBody: Buffer, hmacHeader?: string | string[]): boolean {
  const secret = process.env.SHOPIFY_API_SECRET || '';
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


