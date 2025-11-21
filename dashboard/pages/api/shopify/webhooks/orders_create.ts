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
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const raw = await readRawBody(req);
  const ok = verifyShopifyWebhook(raw, req.headers['x-shopify-hmac-sha256'] as string | undefined);
  if (!ok) return res.status(401).json({ error: 'Invalid HMAC' });

  const payload = JSON.parse(raw.toString('utf8'));
  const shopDomain = String(req.headers['x-shopify-shop-domain'] || payload?.domain || '');
  const db = getFirestore();

  let storeId = '';
  try {
    const q = await db.collection('stores')
      .where('storeType', '==', 'shopify')
      .where('shopDomain', '==', shopDomain)
      .limit(1)
      .get();
    if (!q.empty) storeId = q.docs[0].id;
  } catch {}

  await db.collection('shopify_events').add({
    storeId: storeId || null,
    shopDomain,
    type: 'orders/create',
    payload,
    createdAt: new Date(),
  });

  const checkoutToken = String(payload?.checkout_token || payload?.checkout_id || '');
  const email = String(payload?.email || payload?.customer?.email || '');
  const orderId = String(payload?.id || payload?.order_number || '');

  try {
    const col = db.collection('shopify_abandoned_checkouts');
    let docId: string | null = null;

    if (checkoutToken) {
      const q1 = await col.where('checkoutId', '==', checkoutToken).limit(1).get();
      if (!q1.empty) docId = q1.docs[0].id;
    }
    if (!docId && email) {
      const q2 = await col.where('email', '==', email).limit(1).get();
      if (!q2.empty) docId = q2.docs[0].id;
    }

    if (docId) {
      await col.doc(docId).set({
        completed: true,
        orderId,
        updatedAt: new Date(),
      }, { merge: true });
    }
  } catch {}

  return res.status(200).json({ ok: true });
}

