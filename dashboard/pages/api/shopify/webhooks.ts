import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp();
}

function getHeaderValue(header: string | string[] | undefined): string | null {
  if (!header) return null;
  return Array.isArray(header) ? header[0] ?? null : header;
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

async function handleCheckoutEvent(
  shop: string,
  token: string,
  payload: any,
  topic: string
): Promise<void> {
  if (!token) return;
  const db = getFirestore();
  const docRef = db.collection('shops').doc(shop).collection('checkouts').doc(token);

  const record = {
    shop,
    token,
    email: payload?.email || null,
    lineItems: payload?.line_items || [],
    totalPrice: payload?.total_price ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'pending',
    lastEmailSent: null,
    firstSentAt: null,
    secondSentAt: null,
  };

  if (topic === 'checkouts/update') {
    await docRef.set(record, { merge: true });
  } else {
    await docRef.set(record);
  }
}

async function handleOrderEvent(shop: string, payload: any): Promise<void> {
  const token = payload?.checkout?.token;
  if (!token) return;
  const db = getFirestore();
  const docRef = db.collection('shops').doc(shop).collection('checkouts').doc(token);
  await docRef.set(
    {
      status: 'completed',
      completedAt: Date.now(),
      updatedAt: Date.now(),
    },
    { merge: true }
  );
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
    console.error('Failed to read webhook body', error);
    return res.status(400).json({ error: 'Unable to read body' });
  }

  const hmacHeader = getHeaderValue(req.headers['x-shopify-hmac-sha256']);
  if (!hmacHeader) {
    return res.status(401).json({ error: 'Missing HMAC header' });
  }

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  let provided: Buffer;
  try {
    provided = Buffer.from(hmacHeader, 'base64');
  } catch {
    return res.status(401).json({ error: 'Invalid HMAC format' });
  }

  const expected = Buffer.from(digest, 'base64');
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    console.error('Invalid JSON payload', error);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const shopHeader = getHeaderValue(req.headers['x-shopify-shop-domain']);
  if (!shopHeader) {
    return res.status(400).json({ error: 'Missing shop domain' });
  }
  const shop = shopHeader.toLowerCase().trim();

  const topicHeader = getHeaderValue(req.headers['x-shopify-topic']) || '';
  const topic = topicHeader.toLowerCase();

  try {
    if (topic === 'checkouts/create' || topic === 'checkouts/update') {
      await handleCheckoutEvent(shop, payload?.token, payload, topic);
    } else if (topic === 'orders/create') {
      await handleOrderEvent(shop, payload);
    }
  } catch (error) {
    console.error('Failed to process webhook', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }

  return res.status(200).json({ success: true });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

