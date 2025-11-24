import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import axios from 'axios';
import { adminDatabase } from '../../../lib/firebaseAdmin';
import { resolveAppUrl, resolveShopifyRedirectUri } from '../../../lib/shopifyConfig';

const STATE_COOKIE = 'shopify_oauth_state';
const WEBHOOK_TOPICS = ['checkouts/create', 'checkouts/update', 'orders/create'];

function sanitizeKey(value: string) {
  return value.replace(/[.#$/\[\]]/g, '_');
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

function parseCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      return rest.join('=');
    }
  }
  return null;
}

function clearStateCookie(res: NextApiResponse) {
  res.setHeader('Set-Cookie', `${STATE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
}

function toSingle(param: string | string[] | undefined): string | null {
  if (Array.isArray(param)) return param[0] || null;
  return typeof param === 'string' ? param : null;
}

function buildMessageFromQuery(query: NextApiRequest['query']): string {
  const entries: [string, string][] = [];
  for (const key of Object.keys(query)) {
    if (key === 'hmac' || typeof query[key] === 'undefined') continue;
    const value = Array.isArray(query[key]) ? query[key]?.[0] : query[key];
    if (typeof value === 'string') {
      entries.push([key, value]);
    }
  }
  entries.sort(([a], [b]) => (a > b ? 1 : -1));
  return entries.map(([k, v]) => `${k}=${v}`).join('&');
}

function encrypt(text: string): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('Missing encryption key');
  }
  const keyBuffer = Buffer.from(key, 'utf-8');
  if (keyBuffer.length !== 32) {
    throw new Error('Encryption key must be 32 bytes');
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-ctr', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const shop = toSingle(req.query.shop);
  const code = toSingle(req.query.code);
  const state = toSingle(req.query.state);
  const hmac = toSingle(req.query.hmac);

  if (!shop || !code || !state || !hmac) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const cookieState = parseCookie(req.headers.cookie, STATE_COOKIE);
  clearStateCookie(res);
  if (!cookieState || cookieState !== state) {
    return res.status(400).json({ error: 'Invalid state' });
  }

  const stateRef = adminDatabase.ref(`shopify_states/${state}`);
  const stateSnapshot = await stateRef.get();
  await stateRef.remove().catch(() => {});

  if (!stateSnapshot.exists()) {
    return res.status(400).json({ error: 'State expired or invalid' });
  }

  const stateData = stateSnapshot.val() as { uid?: string; shop?: string } | null;
  const uid = stateData?.uid;
  if (!uid) {
    return res.status(400).json({ error: 'Missing session user' });
  }

  const normalizedShop = normalizeShopDomain(shop);
  if (!normalizedShop.endsWith('.myshopify.com')) {
    return res.status(400).json({ error: 'Invalid shop domain' });
  }
  const stateShop = normalizeShopDomain(stateData?.shop || null);
  if (stateShop && stateShop !== normalizedShop) {
    return res.status(400).json({ error: 'Shop mismatch' });
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Shopify secret not configured' });
  }
  const redirectUri = resolveShopifyRedirectUri();
  if (!redirectUri) {
    return res.status(500).json({ error: 'Shopify redirect URI not configured' });
  }

  const message = buildMessageFromQuery(req.query);
  const generated = crypto.createHmac('sha256', secret).update(message).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(hmac, 'hex');
  } catch {
    return res.status(400).json({ error: 'Invalid HMAC' });
  }

  if (provided.length !== generated.length || !crypto.timingSafeEqual(generated, provided)) {
    return res.status(400).json({ error: 'Invalid HMAC' });
  }

  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Shopify key not configured' });
  }

  let tokenResponse: { access_token: string; scope?: string };
  try {
    const { data } = await axios.post<{ access_token: string; scope?: string }>(
      `https://${normalizedShop}/admin/oauth/access_token`,
      {
        client_id: apiKey,
        client_secret: secret,
        code,
        redirect_uri: redirectUri,
      }
    );
    tokenResponse = data;
    console.log('[Shopify Callback] Granted scopes for', normalizedShop, data.scope);
  } catch (error) {
    console.error('Shopify token exchange failed', error);
    return res.status(500).json({ error: 'Failed to exchange token' });
  }

  const encryptedToken = encrypt(tokenResponse.access_token);
  const shopKey = sanitizeKey(normalizedShop);
  const grantedScopes = (tokenResponse.scope || '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
  const grantedScopeString = grantedScopes.join(',');
  const connectedAt = Date.now();

  try {
    await adminDatabase.ref(`shops/${shopKey}`).set({
      shop: normalizedShop,
      accessToken: encryptedToken,
      scopes: grantedScopeString,
      installedAt: connectedAt,
      lastSynced: null,
      userId: uid,
    });

    const integrationRecord = {
      connected: true,
      shopDomain: normalizedShop,
      scopes: grantedScopeString,
      connectedAt,
      lastSynced: null,
      accessToken: encryptedToken,
    };

    await adminDatabase.ref(`users/${uid}/integrations/shopify`).set(integrationRecord);
    await adminDatabase.ref(`users/${uid}/shopify`).set({
      accessToken: encryptedToken,
      shopDomain: normalizedShop,
      scopes: grantedScopeString,
      connected: true,
      connectedAt,
      lastSynced: null,
    });
  } catch (error) {
    console.error('Failed to save shop record', error);
    return res.status(500).json({ error: 'Failed to save shop' });
  }

  const appUrl = resolveAppUrl();
  if (!appUrl) {
    return res.status(500).json({ error: 'App URL not configured' });
  }

  await Promise.all(
    WEBHOOK_TOPICS.map(async (topic) => {
      try {
        await axios.post(
          `https://${normalizedShop}/admin/api/2023-10/webhooks.json`,
          {
            webhook: {
              topic,
              address: `${appUrl}/api/shopify/webhooks`,
              format: 'json',
            },
          },
          {
            headers: {
              'X-Shopify-Access-Token': tokenResponse.access_token,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (error) {
        console.error(`Failed to register webhook for ${topic}`, error);
      }
    })
  );

  res.writeHead(302, { Location: '/dashboard?connected=shopify' });
  res.end();
}

