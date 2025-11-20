import type { NextApiRequest, NextApiResponse } from 'next';
import { buildAuthUrl, normalizeShopDomain } from '../../../dashboard/lib/shopify';
import { requireUser } from '../../../dashboard/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    let uid = 'anonymous';
    try { uid = (await requireUser(req)).uid; } catch {}

    const shopParam = String(req.query.shop || '');
    if (!shopParam) return res.status(400).json({ error: 'Missing shop' });
    const shop = normalizeShopDomain(shopParam);
    const { url } = buildAuthUrl(shop, uid);

    res.writeHead(302, { Location: url });
    return res.end();
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return res.status(status).json({ error: e?.message || 'Internal error' });
  }
}


