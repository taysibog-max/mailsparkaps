import type { NextApiRequest, NextApiResponse } from 'next';
import { exchangeCodeForToken, normalizeShopDomain, verifyState, encryptAccessToken } from '../../../lib/shopify';
import { getFirestore } from '../../../lib/firestoreAdmin';
import { adminDatabase } from '../../../lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const shopParam = String(req.query.shop || '');
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!shopParam || !code || !state) return res.status(400).json({ error: 'Missing params' });

    const uid = verifyState(state);
    if (!uid) return res.status(401).json({ error: 'Invalid state' });

    const shopDomain = normalizeShopDomain(shopParam);
    const accessToken = await exchangeCodeForToken(shopDomain, code);
    const encrypted = encryptAccessToken(accessToken);

    // Save in Firestore stores collection
    const db = getFirestore();
    const storeId = `shopify:${shopDomain}`;
    await db.collection('stores').doc(storeId).set({
      storeId,
      userId: uid,
      storeType: 'shopify',
      shopDomain,
      shopifyAccessToken: encrypted,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { merge: true });

    // Map store owner for webhooks/pixel resolution (RTDB)
    try {
      const rawKey = shopDomain.toLowerCase();
      const underscoreKey = rawKey.replace(/\./g, '_');
      await adminDatabase.ref(`storeOwners/${rawKey}`).set(uid);
      await adminDatabase.ref(`storeOwners/${underscoreKey}`).set(uid);
    } catch (_) {}

    // Optionally auto-register webhooks
    try {
      const base =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
      if (base) {
        await fetch(`${base}/api/shopify/registerWebhooks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shopDomain, storeId }),
        }).catch(()=>{});
      }
    } catch (_) {}

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (appUrl) return res.redirect(`${appUrl}/dashboard/integrations?connected=shopify`);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}


