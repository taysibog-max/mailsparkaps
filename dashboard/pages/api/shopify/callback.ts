import type { NextApiRequest, NextApiResponse } from 'next';
import { exchangeCodeForToken, normalizeShopDomain, verifyState, encryptAccessToken, verifyOAuthHmac } from '../../../lib/shopify';
import { adminDatabase } from '../../../lib/firebaseAdmin';
import { saveShopifyStore } from '../../../lib/shopifyStore';
import { registerShopifyWebhooks } from '../../../lib/shopifyWebhooks';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const shopParam = String(req.query.shop || '');
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const hmac = String(req.query.hmac || '');
    if (!shopParam || !code || !state || !hmac) return res.status(400).json({ error: 'Missing params' });

    // Verify OAuth HMAC per Shopify spec
    if (!verifyOAuthHmac(req.query as any)) {
      return res.status(401).json({ error: 'Invalid HMAC' });
    }

    const uid = verifyState(state);
    if (!uid) return res.status(401).json({ error: 'Invalid state' });

    const shopDomain = normalizeShopDomain(shopParam);
    const accessToken = await exchangeCodeForToken(shopDomain, code);
    const encrypted = encryptAccessToken(accessToken);

    // Save store (autoId) in Firestore
    const storeId = await saveShopifyStore(uid, shopDomain, encrypted);

    // Map store owner for webhooks/pixel resolution (RTDB)
    try {
      const rawKey = shopDomain.toLowerCase();
      const underscoreKey = rawKey.replace(/\./g, '_');
      await adminDatabase.ref(`storeOwners/${rawKey}`).set(uid);
      await adminDatabase.ref(`storeOwners/${underscoreKey}`).set(uid);
    } catch (_) {}

    // Auto-register webhooks (idempotent)
    try {
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      if (base) {
        await registerShopifyWebhooks(shopDomain, accessToken, base);
      }
    } catch (_) {}

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (appUrl) return res.redirect(`${appUrl}/dashboard?connected=shopify`);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}


