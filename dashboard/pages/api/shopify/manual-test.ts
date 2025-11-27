import type { NextApiRequest, NextApiResponse } from 'next';
import { sanitizeShopDomain } from '../../../utils/pixelTypes';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { shopDomain, token } = req.body || {};
  const normalizedDomain = sanitizeShopDomain(String(shopDomain || ''));
  const trimmedToken = typeof token === 'string' ? token.trim() : '';

  if (!normalizedDomain || !normalizedDomain.endsWith('.myshopify.com')) {
    return res.status(400).json({ ok: false, error: 'invalid_shop_domain' });
  }
  if (!trimmedToken || trimmedToken.length < 20) {
    return res.status(400).json({ ok: false, error: 'invalid_token_format' });
  }

  try {
    const response = await fetch(`https://${normalizedDomain}/admin/api/2024-01/shop.json`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': trimmedToken,
      },
    });

    if (response.status !== 200) {
      return res.status(200).json({ ok: false, error: 'invalid_token' });
    }

    const data = await response.json().catch(() => ({}));
    return res.status(200).json({ ok: true, shop: data?.shop || null });
  } catch (error: any) {
    console.error('[shopify/manual-test] Error:', error?.message || error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}


