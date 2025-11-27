import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDatabase } from '../../../lib/firebaseAdmin';
import { sanitizeFirebaseKey } from '../../../utils/firebasePixel';
import { sanitizeShopDomain } from '../../../utils/pixelTypes';
import { encryptToken } from '../../../utils/shopify/tokenEncryptor';
import { verifyManualToken } from '../../../utils/shopify/verifyManualToken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const { shopDomain, token, uid } = req.body || {};
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ ok: false, error: 'missing_uid' });
    }

    const normalizedDomain = sanitizeShopDomain(String(shopDomain || ''));
    if (!normalizedDomain || !normalizedDomain.endsWith('.myshopify.com')) {
      return res.status(400).json({ ok: false, error: 'invalid_shop_domain' });
    }

    const trimmedToken = typeof token === 'string' ? token.trim() : '';
    if (!trimmedToken || trimmedToken.length < 20) {
      return res.status(400).json({ ok: false, error: 'invalid_token_format' });
    }

    const verified = await verifyManualToken(normalizedDomain, trimmedToken);
    if (!verified) {
      return res.status(200).json({ ok: false, error: 'invalid_token' });
    }

    let encryptedToken: string;
    try {
      encryptedToken = encryptToken(trimmedToken);
    } catch (err) {
      console.error('[shopify/manual-connect] Encryption error:', err);
      return res.status(500).json({ ok: false, error: 'encryption_failed' });
    }

    const now = Date.now();
    const shopKey = sanitizeFirebaseKey(normalizedDomain);
    const userPath = `users/${uid}/integrations/shopify`;
    const shopPath = `shops/${shopKey}`;
    const ownersPath = `storeOwners/${shopKey}`;

    const userIntegration = {
      connected: true,
      shopDomain: normalizedDomain,
      accessToken: encryptedToken,
      connectedAt: now,
      type: 'manual',
    };

    const shopRecord = {
      shop: normalizedDomain,
      accessToken: encryptedToken,
      installedAt: now,
      type: 'manual',
      userId: uid,
    };

    await Promise.all([
      adminDatabase.ref(userPath).set(userIntegration),
      adminDatabase.ref(shopPath).set(shopRecord),
      adminDatabase.ref(ownersPath).set(uid).catch(() => null),
    ]);

    return res.status(200).json({
      ok: true,
      shopDomain: normalizedDomain,
      connectedAt: now,
    });
  } catch (error: any) {
    console.error('[shopify/manual-connect] Unexpected error:', error?.message || error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}


