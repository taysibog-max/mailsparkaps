import type { NextApiRequest, NextApiResponse } from 'next';
import { buildAuthUrl, normalizeShopDomain } from '../../../lib/shopify';
import { requireUser } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    // Prefer authenticated flow; but allow unauthenticated redirects (server-side) if needed
    let uid = 'anonymous';
    try { uid = (await requireUser(req)).uid; } catch (_) {}

    const shopParam = String(req.query.shop || '');
    if (!shopParam) return res.status(400).json({ error: 'Missing shop' });
    const shop = normalizeShopDomain(shopParam);
    const { url } = buildAuthUrl(shop, uid);

    // Support both JSON response (for SPA) and 302 redirect (for direct navigation)
    const wantsRedirect = String(req.query.redirect || '').toLowerCase() === '1' ||
      (req.headers.accept || '').includes('text/html');
    if (wantsRedirect) {
      res.writeHead(302, { Location: url });
      return res.end();
    }
    return res.status(200).json({ authUrl: url });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return res.status(status).json({ error: e?.message || 'Internal error' });
  }
}


