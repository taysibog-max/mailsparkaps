import type { NextApiRequest, NextApiResponse } from 'next';
import { buildAuthUrl } from '../../../lib/shopify';
import { signState } from '../../../lib/crypto';
import { requireUser } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { uid } = await requireUser(req);
    const shop = String(req.query.shop || '');
    if (!shop) return res.status(400).json({ error: 'Missing shop' });

    const stateRaw = `${uid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const stateSig = signState(stateRaw);
    const state = Buffer.from(`${stateRaw}:${stateSig}`, 'utf8').toString('base64');

    const { url } = buildAuthUrl(shop, state);
    return res.status(200).json({ authUrl: url });
  } catch (e: any) {
    const msg = e?.message || 'Internal error';
    const status = msg === 'Unauthorized' ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}




