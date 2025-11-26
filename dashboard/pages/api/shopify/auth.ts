import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { adminDatabase } from '../../../lib/firebaseAdmin';
import { getShopifyConfig } from '../../../lib/shopifyConfig';

const STATE_COOKIE = 'shopify_oauth_state';
const MAX_AGE_SECONDS = 300;

function normalizeShopDomain(raw: string | null): string {
  if (!raw) return '';
  let value = raw.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.split('?')[0] || '';
  value = value.split('#')[0] || '';
  value = value.replace(/\/+$/, '');
  return value;
}

function parseScopes(scopes: string): string {
  return scopes
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean)
    .join(',');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const shopParam = typeof req.query.shop === 'string' ? req.query.shop : null;
  const uidParam = typeof req.query.uid === 'string' ? req.query.uid : null;
  const normalizedShop = normalizeShopDomain(shopParam);

  if (!uidParam) {
    return res.status(400).json({ error: 'Missing uid parameter' });
  }

  if (!normalizedShop || !normalizedShop.endsWith('.myshopify.com')) {
    return res.status(400).json({ error: 'Invalid Shopify shop domain' });
  }

  const { apiKey, redirectUri, scopes } = (() => {
    const config = getShopifyConfig();
    return {
      apiKey: config.apiKey,
      redirectUri: config.redirectUri,
      scopes: parseScopes(config.scopes),
    };
  })();

  if (!apiKey || !redirectUri || !scopes) {
    return res.status(500).json({ error: 'Shopify OAuth is not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');

  try {
    await adminDatabase.ref(`shopify_states/${state}`).set({
      uid: uidParam,
      shop: normalizedShop,
      scopes,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('[Shopify Auth] Failed to persist state', error);
    return res.status(500).json({ error: 'Failed to initialize Shopify authorization' });
  }

  res.setHeader(
    'Set-Cookie',
    `${STATE_COOKIE}=${state}; Max-Age=${MAX_AGE_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`
  );

  const oauthUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
  oauthUrl.searchParams.set('client_id', apiKey);
  oauthUrl.searchParams.set('scope', scopes);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('grant_options[]', 'per-user');

  if (process.env.NODE_ENV === 'development') {
    console.log('[Shopify Auth] Redirecting to', oauthUrl.toString());
  }

  res.writeHead(302, { Location: oauthUrl.toString() });
  res.end();
}

