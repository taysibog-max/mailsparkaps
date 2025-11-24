import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';

const DEFAULT_SCOPES = 'read_checkouts,read_orders,write_orders';
const REQUIRED_SCOPES = ['read_orders'];
const STATE_COOKIE = 'shopify_oauth_state';

function mergeScopes(scopes: string): string {
  const items = scopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
  const set = new Set(items);
  REQUIRED_SCOPES.forEach((scope) => set.add(scope));
  return Array.from(set).join(',');
}

function normalizeShopDomain(raw: string | null): string {
  if (!raw) return '';
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.split('?')[0] || '';
  value = value.split('#')[0] || '';
  value = value.replace(/\/+$/, '');
  return value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const shopInput =
    typeof req.body === 'object' && req.body !== null ? (req.body as { shop?: string }).shop : undefined;
  const normalizedShop = normalizeShopDomain(typeof shopInput === 'string' ? shopInput : '');

  if (!normalizedShop || !normalizedShop.endsWith('.myshopify.com')) {
    return res.status(400).json({ error: 'Invalid Shopify shop domain' });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  const scopes = mergeScopes(process.env.SHOPIFY_SCOPES || DEFAULT_SCOPES);

  if (!apiKey || !redirectUri) {
    return res.status(500).json({ error: 'Shopify OAuth is not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');

  try {
    await adminDatabase.ref(`shopify_states/${state}`).set({
      uid,
      shop: normalizedShop,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('[Shopify Start] Failed to persist state', error);
    return res.status(500).json({ error: 'Failed to initialize Shopify authorization' });
  }

  res.setHeader(
    'Set-Cookie',
    `${STATE_COOKIE}=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`
  );

  const oauthUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
  oauthUrl.searchParams.set('client_id', apiKey);
  oauthUrl.searchParams.set('scope', scopes);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('grant_options[]', 'per-user');

  return res.status(200).json({ redirectUrl: oauthUrl.toString() });
}

