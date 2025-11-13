import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { exchangeCodeForToken, normalizeShopDomain } from '../../../lib/shopify';
import { getFirestore } from '../../../lib/firestoreAdmin';
import { encryptAccessToken } from '../../../lib/shopify';

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

    // Redirect to dashboard after connect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const redirectPath = `${appUrl}/dashboard/shopify`;
    return res.redirect(`${redirectPath}?connected=${encodeURIComponent(shop)}`);
  } catch (e: any) {
    console.error('Shopify callback error', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}


