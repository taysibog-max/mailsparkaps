import { getFirestore as getAdminFirestore } from './firestoreAdmin';

export interface SavedShopifyStore {
  storeType: 'shopify';
  shopDomain: string;
  accessToken: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function saveShopifyStore(userId: string, shopDomain: string, accessToken: string): Promise<string> {
  const db = getAdminFirestore();
  const payload: SavedShopifyStore = {
    storeType: 'shopify',
    shopDomain,
    accessToken,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const ref = await db.collection('stores').add(payload);
  return ref.id;
}

export async function updateShopifyStore(storeId: string) {
  const db = getAdminFirestore();
  await db.collection('stores').doc(storeId).set({ updatedAt: new Date() }, { merge: true });
}

import { getFirestore } from './firestoreAdmin';
import * as admin from 'firebase-admin';

export interface SavedShopifyStore {
  id: string;
  storeType: 'shopify';
  shopDomain: string;
  accessToken: string;
  userId: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export async function saveShopifyStore(userId: string, shopDomain: string, accessToken: string): Promise<SavedShopifyStore> {
  const db = getFirestore();
  const ref = db.collection('stores').doc(); // autoId
  const payload = {
    storeType: 'shopify' as const,
    shopDomain,
    accessToken,
    userId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await ref.set(payload, { merge: true });
  const snap = await ref.get();
  const data = snap.data() as any;
  return {
    id: ref.id,
    storeType: 'shopify',
    shopDomain: data.shopDomain,
    accessToken: data.accessToken,
    userId: data.userId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function registerShopifyWebhooks(shopDomain: string, accessToken: string): Promise<void> {
  // Helper spreman za registraciju web‑hookova (pozovi iz callback-a po potrebi)
  const topics = [
    'checkouts/create',
    'checkouts/update',
    'carts/update',
    'orders/create',
    'customers/create',
  ];
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!base) return;
  const address = `${base}/api/webhooks/shopify`;
  for (const topic of topics) {
    try {
      await fetch(`https://${shopDomain}/admin/api/2024-07/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
      });
    } catch (_) {}
  }
}


