import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';
import { resolveShopifyRedirectUri } from '../../../lib/shopifyConfig';

const REQUIRED_SCOPES = [
  'read_orders',
  'write_orders',
  'read_checkouts',
  'write_customers',
  'read_customers',
];
const DEFAULT_SCOPE_STRING = REQUIRED_SCOPES.join(',');
const CANONICAL_SCOPE_SIGNATURE = [...REQUIRED_SCOPES].sort().join(',');
const STATE_COOKIE = 'shopify_oauth_state';

function parseScopes(scopes: string): string[] {
  return scopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function buildScopeString(rawScopes: string): string {
  const orderedScopes: string[] = [];
  const seen = new Set<string>();

  parseScopes(rawScopes).forEach((scope) => {
    if (!seen.has(scope)) {
      orderedScopes.push(scope);
      seen.add(scope);
    }
  });

  REQUIRED_SCOPES.forEach((required) => {
    if (!seen.has(required)) {
      orderedScopes.push(required);
      seen.add(required);
    }
  });

  return orderedScopes.join(',');
}

function warnIfScopesChanged(rawScopes: string) {
  const normalized = parseScopes(rawScopes);
  const signature = Array.from(new Set(normalized))
    .sort()
    .join(',');
  if (signature !== CANONICAL_SCOPE_SIGNATURE) {
    console.warn('You changed Shopify scopes — uninstall and reinstall the app.');
  }
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
  const redirectUri = resolveShopifyRedirectUri();
  const rawScopeString = process.env.SHOPIFY_SCOPES || DEFAULT_SCOPE_STRING;
  warnIfScopesChanged(rawScopeString);
  const scopes = buildScopeString(rawScopeString);

  if (!apiKey || !redirectUri) {
    return res.status(500).json({ error: 'Shopify OAuth is not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');

  try {
    await adminDatabase.ref(`shopify_states/${state}`).set({
      uid,
      shop: normalizedShop,
      scopes,
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

