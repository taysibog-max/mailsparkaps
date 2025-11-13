import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyShopifyWebhook } from '../../../../lib/shopify';
import { getFirestore } from '../../../../lib/firestoreAdmin';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const raw = await readRawBody(req);
    const hmac = req.headers['x-shopify-hmac-sha256'];
    if (!verifyShopifyWebhook(raw, hmac)) {
      return res.status(401).send('Invalid HMAC');
    }

    const topic = String(req.query.topic || req.headers['x-shopify-topic'] || 'unknown');
    const shop = String(req.headers['x-shopify-shop-domain'] || '');
    const payload = JSON.parse(raw.toString('utf8'));

    const db = getFirestore();
    const storeId = shop ? shop.replace(/\./g, '_') : 'unknown';

    if (topic === 'carts/update' || topic === 'checkouts/update') {
      const cartId = String(payload.id || payload.token || payload.cart_token || Date.now());
      await db.collection('stores').doc(storeId)
        .collection('abandoned_carts').doc(cartId).set({
          email: payload?.email || payload?.customer?.email || '',
          items: payload?.line_items || payload?.items || [],
          lastUpdate: new Date(),
          recovered: false,
          emailSent: payload?.emailSent ?? false,
        }, { merge: true });
    }

    if (topic === 'orders/create') {
      const orderId = String(payload.id || payload.order_number || Date.now());
      await db.collection('stores').doc(storeId)
        .collection('orders').doc(orderId).set({
          total: Number(payload?.total_price) || 0,
          email: payload?.email || payload?.customer?.email || '',
          createdAt: new Date(),
        }, { merge: true });
    }

    if (topic === 'customers/create') {
      // Could store basic customer info per store if needed
      await db.collection('stores').doc(storeId)
        .collection('customers').doc(String(payload.id)).set({
          email: payload?.email || '',
          firstName: payload?.first_name || '',
          lastName: payload?.last_name || '',
          createdAt: new Date(),
        }, { merge: true });
    }

    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('Shopify webhook error', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}




