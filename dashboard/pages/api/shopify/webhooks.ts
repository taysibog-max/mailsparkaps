import type { NextApiRequest, NextApiResponse } from 'next';
import { adminDatabase } from '../../../lib/firebaseAdmin';
import { verifyWebhookHmac } from '../../../lib/shopify/webhookVerify';
import { getShopDomainFromHeaders, getTopicFromHeaders, normalizeHeaderValue } from '../../../lib/shopify/headers';
import { isCheckoutAbandoned } from '../../../utils/shopifyAbandoned';

const sanitizeKey = (value: string) => value.replace(/[.#$/\[\]]/g, '_');
const DEBUG =
  typeof process.env.DEBUG_SHOPIFY_WEBHOOKS === 'string'
    ? /^(1|true|yes)$/i.test(process.env.DEBUG_SHOPIFY_WEBHOOKS)
    : false;
const ALLOWED_TOPICS = new Set(['checkouts/create', 'checkouts/update', 'orders/create']);

function logDebug(...args: any[]) {
  if (DEBUG) {
    console.log('[Shopify Webhook]', ...args);
  }
}

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function toISOString(value: any, fallback: string | null = null): string | null {
  if (!value) return fallback;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }
  return fallback;
}

function getCheckoutId(payload: any): string | null {
  const id = payload?.id ?? payload?.checkout_id ?? payload?.token ?? payload?.token?.id;
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null;
}

function recordsEqual(a: any, b: any): boolean {
  if (!a || !b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

async function updateShopifyStats(
  uid: string | undefined,
  { abandonedDelta = 0, recoveredDelta = 0, timestamp = Date.now() }: { abandonedDelta?: number; recoveredDelta?: number; timestamp?: number }
) {
  if (!uid || (!abandonedDelta && !recoveredDelta)) return;
  const statsRef = adminDatabase.ref(`users/${uid}/integrations/shopify-abandoned`);
  await statsRef.transaction((current) => {
    const snapshot =
      current || {
        total_abandoned: 0,
        total_recovered: 0,
        last_7_days: {},
      };

    const dayKey = new Date(timestamp).toISOString().slice(0, 10);
    const lastSevenDays = snapshot.last_7_days || {};
    const dayStats = lastSevenDays[dayKey] || { abandoned: 0, recovered: 0 };

    if (abandonedDelta) {
      snapshot.total_abandoned = (snapshot.total_abandoned || 0) + abandonedDelta;
      dayStats.abandoned = (dayStats.abandoned || 0) + abandonedDelta;
    }
    if (recoveredDelta) {
      snapshot.total_recovered = (snapshot.total_recovered || 0) + recoveredDelta;
      dayStats.recovered = (dayStats.recovered || 0) + recoveredDelta;
    }

    lastSevenDays[dayKey] = dayStats;

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    Object.keys(lastSevenDays).forEach((key) => {
      if (new Date(key).getTime() < cutoff) {
        delete lastSevenDays[key];
      }
    });

    snapshot.last_7_days = lastSevenDays;
    return snapshot;
  });
}

function buildCheckoutRecord(payload: any, shopDomain: string) {
  const completedAt = toISOString(payload?.completed_at || payload?.completedAt, null);
  const updatedAt = toISOString(payload?.updated_at || payload?.updatedAt || payload?.created_at || Date.now(), new Date().toISOString());
  const abandonedAt = completedAt ? null : updatedAt;

  return {
    id: payload?.id ?? null,
    token: payload?.token ?? null,
    email: payload?.email || null,
    created_at: toISOString(payload?.created_at) || updatedAt,
    updated_at: updatedAt,
    completed_at: completedAt,
    abandoned_at: abandonedAt,
    line_items: payload?.line_items || [],
    total_price: payload?.total_price ?? payload?.total_line_items_price ?? null,
    currency: payload?.currency || 'USD',
    source_name: payload?.source_name || null,
    referring_site: payload?.referring_site || null,
    checkout_url: payload?.abandoned_checkout_url || payload?.web_url || payload?.checkout_url || null,
    shopDomain,
    status: completedAt ? 'completed' : 'open',
  };
}

async function persistCheckoutRecords({
  shopKey,
  checkoutKey,
  record,
  uid,
}: {
  shopKey: string;
  checkoutKey: string;
  record: any;
  uid?: string;
}) {
  const updates: Promise<any>[] = [];
  updates.push(adminDatabase.ref(`shops/${shopKey}/checkouts/${checkoutKey}`).set(record));
  if (uid) {
    updates.push(adminDatabase.ref(`users/${uid}/checkouts/${checkoutKey}`).set(record));
  }
  await Promise.all(updates);
}

async function processCheckoutEvent(shopDomain: string, payload: any) {
  const checkoutId = getCheckoutId(payload);
  if (!checkoutId) return;

  const shopKey = sanitizeKey(shopDomain);
  const shopSnapshot = await adminDatabase.ref(`shops/${shopKey}`).get();
  const shopData = shopSnapshot.exists() ? shopSnapshot.val() : null;
  const uid: string | undefined = shopData?.userId || undefined;

  const checkoutKey = sanitizeKey(checkoutId);
  const checkoutRecord = buildCheckoutRecord(payload, shopDomain);
  const checkoutRef = adminDatabase.ref(`shops/${shopKey}/checkouts/${checkoutKey}`);
  const existingSnapshot = await checkoutRef.get();
  const existingRecord = existingSnapshot.exists() ? existingSnapshot.val() : null;

  if (!checkoutRecord.completed_at && isCheckoutAbandoned(checkoutRecord)) {
    checkoutRecord.status = 'abandoned';
  }

  if (existingRecord && recordsEqual(existingRecord, checkoutRecord)) {
    return;
  }

  await persistCheckoutRecords({ shopKey, checkoutKey, record: checkoutRecord, uid });

  const wasAbandoned = existingRecord ? isCheckoutAbandoned(existingRecord) : false;
  const isNowAbandoned = isCheckoutAbandoned(checkoutRecord);
  if (!wasAbandoned && isNowAbandoned) {
    await updateShopifyStats(uid, { abandonedDelta: 1, timestamp: Date.now() });
  }
}

async function processOrderEvent(shopDomain: string, payload: any) {
  const shopKey = sanitizeKey(shopDomain);
  const shopSnapshot = await adminDatabase.ref(`shops/${shopKey}`).get();
  const shopData = shopSnapshot.exists() ? shopSnapshot.val() : null;
  const uid: string | undefined = shopData?.userId || undefined;

  const orderId = payload?.id;
  const checkoutId = payload?.checkout_id ?? payload?.checkout?.id ?? payload?.checkout?.token ?? payload?.token;
  const orderKey = typeof orderId === 'string' || typeof orderId === 'number' ? sanitizeKey(String(orderId)) : null;
  const resolvedCheckoutKey =
    typeof checkoutId === 'string' || typeof checkoutId === 'number'
      ? sanitizeKey(String(checkoutId))
      : sanitizeKey(String(checkoutId || orderId || `order-${orderId || Date.now()}`));

  if (!orderKey) return;

  const orderRecord = {
    id: orderId ?? null,
    email: payload?.email || null,
    total_price: payload?.total_price ?? null,
    currency: payload?.currency || 'USD',
    created_at: toISOString(payload?.created_at) || new Date().toISOString(),
    processed_at: toISOString(payload?.processed_at),
    financial_status: payload?.financial_status || null,
    fulfillment_status: payload?.fulfillment_status || null,
    checkout_id: checkoutId ?? null,
    line_items: payload?.line_items || [],
    shopDomain,
  };

  const shopOrderRef = adminDatabase.ref(`shops/${shopKey}/orders/${orderKey}`);
  const existingOrderSnapshot = await shopOrderRef.get();
  const existingOrder = existingOrderSnapshot.exists() ? existingOrderSnapshot.val() : null;
  const writes: Promise<any>[] = [];

  if (!existingOrder || !recordsEqual(existingOrder, orderRecord)) {
    writes.push(shopOrderRef.set(orderRecord));
  }

  if (uid) {
    const userOrderRef = adminDatabase.ref(`users/${uid}/orders/${orderKey}`);
    const userOrderSnapshot = await userOrderRef.get();
    const userOrder = userOrderSnapshot.exists() ? userOrderSnapshot.val() : null;
    if (!userOrder || !recordsEqual(userOrder, orderRecord)) {
      writes.push(userOrderRef.set(orderRecord));
    }
  }

  const checkoutRef = adminDatabase.ref(`shops/${shopKey}/checkouts/${resolvedCheckoutKey}`);
  const userCheckoutRef = uid ? adminDatabase.ref(`users/${uid}/checkouts/${resolvedCheckoutKey}`) : null;
  const checkoutSnapshot = await checkoutRef.get();
  const checkoutExists = checkoutSnapshot.exists();
  const checkoutData = checkoutExists ? checkoutSnapshot.val() : null;

  if (!checkoutExists) {
    const fallbackCheckoutPayload = {
      id: checkoutId || orderId || `order-${orderId || Date.now()}`,
      token: payload?.checkout?.token || null,
      email: payload?.email || payload?.customer?.email || null,
      created_at: payload?.created_at || new Date().toISOString(),
      updated_at: payload?.updated_at || payload?.created_at || new Date().toISOString(),
      completed_at: payload?.processed_at || payload?.created_at || new Date().toISOString(),
      line_items: payload?.line_items || [],
      total_price: payload?.total_price ?? null,
      currency: payload?.currency || 'USD',
    };
    const fallbackRecord = buildCheckoutRecord(fallbackCheckoutPayload, shopDomain);
    fallbackRecord.status = 'completed';
    await persistCheckoutRecords({ shopKey, checkoutKey: resolvedCheckoutKey, record: fallbackRecord, uid });
  }

  const completedAt = toISOString(payload?.completed_at || payload?.processed_at || payload?.created_at, new Date().toISOString());
  const completionPayload = {
    completed_at: completedAt,
    updated_at: toISOString(payload?.updated_at || payload?.processed_at, completedAt),
    status: 'completed',
  };

  writes.push(checkoutRef.update(completionPayload));
  if (userCheckoutRef) {
    writes.push(userCheckoutRef.update(completionPayload));
  }

  const wasAbandoned = checkoutData ? isCheckoutAbandoned(checkoutData) : false;
  if (wasAbandoned) {
    writes.push(updateShopifyStats(uid, { recoveredDelta: 1, timestamp: Date.now() }));
  }

  await Promise.all(writes);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Shopify secret not configured' });
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch (error) {
    console.error('[Shopify Webhook] Failed to read body', error);
    return res.status(400).json({ error: 'Unable to read body' });
  }

  const hmacHeader = normalizeHeaderValue(req.headers['x-shopify-hmac-sha256']);
  if (!hmacHeader || !verifyWebhookHmac(rawBody, hmacHeader, secret)) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    console.error('[Shopify Webhook] Invalid JSON payload', error);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
    logDebug('Empty payload received');
    return res.status(200).send('OK');
  }

  const shopDomain = getShopDomainFromHeaders(req);
  if (!shopDomain) {
    return res.status(400).json({ error: 'Missing shop domain' });
  }

  const topic = getTopicFromHeaders(req);
  if (!topic || !ALLOWED_TOPICS.has(topic)) {
    return res.status(400).json({ error: 'Unsupported topic' });
  }

  logDebug('Received topic', topic, 'for shop', shopDomain);

  try {
    if (topic === 'checkouts/create' || topic === 'checkouts/update') {
      await processCheckoutEvent(shopDomain, payload);
    } else if (topic === 'orders/create') {
      await processOrderEvent(shopDomain, payload);
    }
  } catch (error) {
    console.error('[Shopify Webhook] Failed to process topic', topic, error);
  }

  return res.status(200).send('OK');
}

export const config = {
  api: {
    bodyParser: false,
  },
};

