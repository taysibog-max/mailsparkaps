import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from '../../../lib/firestoreAdmin';
import { decryptAccessToken, normalizeShopDomain } from '../../../lib/shopify';

async function register(shopDomain: string, accessToken: string, addressBase: string) {
  const topics = [
    'checkouts/create',
    'checkouts/update',
    'carts/update',
    'orders/create',
    'customers/create',
  ];
  const address = `${addressBase}/api/webhooks/shopify`;
  for (const topic of topics) {
    try {
      await fetch(`https://${shopDomain}/admin/api/2024-07/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
      });
    } catch (_) {}
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { storeId, shopDomain: rawShop } = req.body || {};
    const shopDomain = normalizeShopDomain(rawShop || '');
    if (!storeId && !shopDomain) return res.status(400).json({ error: 'Missing storeId or shopDomain' });

    const db = getFirestore();
    const id = storeId || `shopify:${shopDomain}`;
    const doc = await db.collection('stores').doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Store not found' });
    const data = doc.data() as any;
    const enc = data?.shopifyAccessToken || '';
    if (!enc) return res.status(400).json({ error: 'Missing access token' });
    const token = decryptAccessToken(enc);

    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    if (!base) return res.status(400).json({ error: 'Missing app URL' });

    await register(data.shopDomain || shopDomain, token, base);
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}


