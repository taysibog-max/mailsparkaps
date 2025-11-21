import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const DEFAULT_SCOPES = 'read_checkouts,read_orders,write_orders';
const STATE_COOKIE = 'shopify_oauth_state';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const rawShop = Array.isArray(req.query.shop) ? req.query.shop[0] : req.query.shop || '';
  const normalizedShop = rawShop.trim().toLowerCase();

  if (!normalizedShop || !normalizedShop.endsWith('.myshopify.com')) {
    return res.status(400).json({ error: 'Invalid Shopify shop domain' });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
  const scopes = process.env.SHOPIFY_SCOPES || DEFAULT_SCOPES;

  if (!apiKey || !redirectUri) {
    return res.status(500).json({ error: 'Shopify OAuth is not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');

  res.setHeader(
    'Set-Cookie',
    `${STATE_COOKIE}=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`
  );

  const oauthUrl = new URL(`https://${normalizedShop}/admin/oauth/authorize`);
  oauthUrl.searchParams.set('client_id', apiKey);
  oauthUrl.searchParams.set('scope', scopes);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('state', state);

  res.status(302).setHeader('Location', oauthUrl.toString());
  res.end();
}

