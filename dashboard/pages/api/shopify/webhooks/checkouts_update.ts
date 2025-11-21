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
    type: 'checkouts/update',
    payload,
    createdAt: new Date(),
  });

  const checkoutId = String(payload?.id || payload?.token || '');
  const email = String(payload?.email || payload?.contact_email || payload?.customer?.email || '');
  const completed = Boolean(payload?.completed || payload?.completed_at || payload?.order_id);
  const lineItems = Array.isArray(payload?.line_items) ? payload.line_items.map((it: any) => ({
    id: it.id || it.variant_id || null,
    title: it.title,
    quantity: it.quantity,
    price: it.price,
  })) : [];
  const currency = payload?.currency || '';
  const subtotalPrice = payload?.subtotal_price || payload?.total_price || null;

  if (checkoutId) {
    const col = db.collection('shopify_abandoned_checkouts');
    const ref = col.doc(checkoutId);
    const now = new Date();
    const toSet: any = {
      storeId: storeId || null,
      shopDomain,
      checkoutId,
      lastUpdateAt: now,
      updatedAt: now,
    };
    if (email) toSet.email = email;
    if (lineItems.length) toSet.lineItems = lineItems;
    if (currency) toSet.currency = currency;
    if (subtotalPrice) toSet.subtotalPrice = subtotalPrice;
    if (completed) {
      toSet.completed = true;
      toSet.orderId = payload?.order_id || null;
    }
    await ref.set(toSet, { merge: true });
  }

  return res.status(200).json({ ok: true });
}

