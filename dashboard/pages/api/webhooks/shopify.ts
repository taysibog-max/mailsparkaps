import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyShopifyWebhook } from '../../../lib/shopify';
import { adminDatabase } from '../../../lib/firebaseAdmin';
import { extractContactFromEvent, saveOrUpdateContact } from '../../../lib/contactsHelpers';

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
    const hmac = req.headers['x-shopify-hmac-sha256'] as string | undefined;
    if (!verifyShopifyWebhook(raw, hmac)) {
      return res.status(401).json({ error: 'Invalid HMAC' });
    }

    const topic = String(req.headers['x-shopify-topic'] || 'unknown');
    const shopDomain = String(req.headers['x-shopify-shop-domain'] || '');
    const payload = JSON.parse(raw.toString('utf8'));

    // Resolve owner uid from mapping storeOwners/{shopDomain}
    let userId = shopDomain ? shopDomain.replace(/\./g, '_') : 'unknown';
    try {
      const keyShop = String(shopDomain || '').toLowerCase().replace(/[^a-z0-9.-]/gi, '_');
      const ownerSnap = await adminDatabase.ref(`storeOwners/${keyShop}`).once('value');
      if (ownerSnap.exists()) userId = ownerSnap.val();
    } catch (_) {}

    let eventType: 'cart_abandoned' | 'order_created' | 'customer_created' | 'unknown' = 'unknown';
    let eventData: any = {};

    // Normalize topics to our event model
    if (topic === 'carts/update') {
      // Usually does not include email; ignore to reduce noise
      return res.status(200).json({ success: true, ignored: true });
    }

    if (topic === 'checkouts/create' || topic === 'checkouts/update') {
      eventType = 'cart_abandoned';
      const items = Array.isArray(payload?.line_items) ? payload.line_items : [];
      eventData = {
        cartId: payload?.token || payload?.id || String(Date.now()),
        customerEmail: payload?.email || payload?.customer?.email || payload?.contact_email || '',
        customerName: payload?.customer?.first_name || payload?.billing_address?.first_name || 'Customer',
        items: items.map((it: any) => ({
          name: it.title,
          quantity: it.quantity,
          price: it.price,
        })),
        totalPrice: payload?.total_price || payload?.subtotal_price,
        currency: payload?.currency,
        status: 'pending',
        platform: 'shopify',
        shopDomain,
      };
    } else if (topic === 'orders/create') {
      eventType = 'order_created';
      const items = Array.isArray(payload?.line_items) ? payload.line_items : [];
      eventData = {
        orderId: payload?.id,
        orderNumber: payload?.order_number,
        customerEmail: payload?.email || payload?.customer?.email || '',
        customerName: payload?.customer?.first_name || payload?.billing_address?.first_name || 'Customer',
        items: items.map((it: any) => ({
          name: it.title,
          quantity: it.quantity,
          price: it.price,
        })),
        totalPrice: payload?.total_price,
        currency: payload?.currency,
        platform: 'shopify',
        shopDomain,
      };
    } else if (topic === 'customers/create') {
      eventType = 'customer_created';
      eventData = {
        customerId: payload?.id,
        customerEmail: payload?.email || '',
        customerName: `${payload?.first_name || ''} ${payload?.last_name || ''}`.trim() || 'Customer',
        platform: 'shopify',
        shopDomain,
      };
    }

    const eventId = `shopify_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const eventRef = adminDatabase.ref(`events/${userId}/${eventType}/${eventId}`);
    await eventRef.set({
      ...eventData,
      eventId,
      eventType,
      topic,
      createdAt: Date.now(),
      processedAt: null,
      emailSent: false,
    });

    // Save contact
    const contact = extractContactFromEvent(eventData);
    if (contact) {
      saveOrUpdateContact(adminDatabase, userId, contact, eventType).catch(() => {});
    }

    // Trigger automation immediately except for cart_abandoned
    if (eventType !== 'cart_abandoned') {
      await triggerAutomation(userId, eventId, eventType, eventData);
    }

    return res.status(200).json({ success: true, eventId, eventType });
  } catch (e: any) {
    console.error('[Shopify Webhook] Error:', e);
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}

async function triggerAutomation(userId: string, eventId: string, eventType: string, eventData: any) {
  try {
    const baseUrl =
      process.env.INTERNAL_API_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const headers: any = { 'Content-Type': 'application/json' };
    const bypass =
      process.env.VERCEL_PROTECTION_BYPASS ||
      process.env.PROTECTION_BYPASS_TOKEN ||
      process.env.VERCEL_BYPASS_TOKEN;
    if (bypass) headers['x-vercel-protection-bypass'] = bypass;
    await fetch(`${baseUrl}/api/automation/trigger`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, eventId, eventType, eventData }),
    }).catch(()=>{});
  } catch (_) {}
}


