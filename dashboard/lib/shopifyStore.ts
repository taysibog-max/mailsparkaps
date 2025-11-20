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

