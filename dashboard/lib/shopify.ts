import crypto from 'crypto';
import { encryptToken, decryptToken } from './crypto';

export type ShopifyScopes =
  | 'read_orders' | 'write_orders'
  | 'read_checkouts' | 'write_checkouts'
  | 'read_customers' | 'write_customers'
  | 'read_products';

export const DEFAULT_SCOPES: ShopifyScopes[] = [
  'read_orders', 'write_orders',
  'read_checkouts', 'write_checkouts',
  'read_customers', 'write_customers',
  'read_products',
];

export function normalizeShopDomain(input: string): string {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return '';
  if (!s.includes('.')) s = `${s}.myshopify.com`;
  s = s.replace(/^https?:\/\//, '');
  return s;
}

export function buildAuthUrl(shop: string, state: string, scopes: ShopifyScopes[] = DEFAULT_SCOPES) {
  const normalized = normalizeShopDomain(shop);
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL}/api/shopify/callback`;
  const scopeStr = scopes.join(',');
  const url = `https://${normalized}/admin/oauth/authorize?client_id=${encodeURIComponent(process.env.SHOPIFY_API_KEY || '')}&scope=${encodeURIComponent(scopeStr)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  return { url, redirectUri, normalizedShop: normalized };
}

export async function exchangeCodeForToken(shop: string, code: string) {
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
  const token: string = data.access_token;
  return token;
}

export function verifyShopifyWebhook(rawBody: string | Buffer, hmacHeader: string | string[] | undefined): boolean {
  if (!hmacHeader) return false;
  const secret = process.env.SHOPIFY_API_SECRET || '';
  if (!secret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('base64');
  const received = Array.isArray(hmacHeader) ? hmacHeader[0] : hmacHeader;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(received || '', 'utf8'));
}

export function encryptAccessToken(token: string) {
  return encryptToken(token);
}

export function decryptAccessToken(enc: string) {
  return decryptToken(enc);
}




