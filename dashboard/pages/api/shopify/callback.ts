import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { exchangeCodeForToken, normalizeShopDomain } from '../../../lib/shopify';
import { getFirestore } from '../../../lib/firestoreAdmin';
import { encryptAccessToken } from '../../../lib/shopify';
import { adminDatabase } from '../../../lib/firebaseAdmin';

async function tryRegisterWebhooks(shop: string, accessToken: string) {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    if (!base) return;
    const address = `${base}/api/webhooks/shopify`;
    const topics = [
      'checkouts/update',
      'carts/update',
      'orders/create',
      'app/uninstalled',
    ];
    // Register each webhook idempotently
    for (const topic of topics) {
      try {
        await fetch(`https://${shop}/admin/api/2024-07/webhooks.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address,
              format: 'json',
            },
          }),
        });
      } catch (_) {}
    }
  } catch (_) {}
}

async function tryInstallScriptTag(shop: string, accessToken: string) {
  try {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    if (!base) return;
    const src = `${base}/cart-tracker.js`;
    // Create ScriptTag to load tracker across storefront pages (cart, product, etc.)
    await fetch(`https://${shop}/admin/api/2024-07/script_tags.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        script_tag: {
          event: 'onload',
          src,
          display_scope: 'online_store',
        },
      }),
    });
  } catch (_) {}
}

function verifyState(stateB64: string): string | null {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const shopParam = String(req.query.shop || '');
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!shopParam || !code || !state) return res.status(400).json({ error: 'Missing params' });

    const uid = verifyState(state);
    if (!uid) return res.status(401).json({ error: 'Invalid state' });

    const shop = normalizeShopDomain(shopParam);
    const token = await exchangeCodeForToken(shop, code);
    const encrypted = encryptAccessToken(token);

    const db = getFirestore();
    const storeId = shop.replace(/\./g, '_');

    await db.collection('shopifyConnections').doc(storeId).set({
      userId: uid,
      shop,
      accessToken: encrypted,
      connectedAt: new Date(),
      active: true,
    }, { merge: true });

    // Map shop domain to our userId for quick resolution in webhooks/pixel
    try {
      const rawKey = shop.toLowerCase();
      const underscoreKey = rawKey.replace(/\./g, '_');
      await adminDatabase.ref(`storeOwners/${rawKey}`).set(uid);
      await adminDatabase.ref(`storeOwners/${underscoreKey}`).set(uid);
    } catch (_) {}

    // Mirror connection into Realtime Database so webhook može čitati accessToken
    try {
      await adminDatabase.ref(`users/${uid}/integrations/shopify`).update({
        shop,
        accessToken: token,
        connectedAt: Date.now(),
        lastSynced: Date.now(),
      });
    } catch (_) {}

    // Attempt to auto-register webhooks so korisnik ne mora ništa ručno
    try { await tryRegisterWebhooks(shop, token); } catch (_) {}
    // Attempt to auto-install ScriptTag (cart/page tracker). Napomena: ne učitava se na checkoutu (osim Plus),
    // ali pokriva cart i većinu tema za rani capture emaila.
    try { await tryInstallScriptTag(shop, token); } catch (_) {}

    // Redirect to dashboard after connect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const redirectPath = `${appUrl}/dashboard/shopify`;
    return res.redirect(`${redirectPath}?connected=${encodeURIComponent(shop)}`);
  } catch (e: any) {
    console.error('Shopify callback error', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}


