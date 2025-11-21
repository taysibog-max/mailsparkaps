import { getFirebaseApp } from '../lib/firebaseClient';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export type StorePlatform = 'woocommerce' | null;

export type StoreConnection = {
  platform: StorePlatform;
  connected: boolean;
  data?: any;
};

// Reads connection from Firestore. Supports multiple layouts to be robust.
export async function checkStoreConnection(): Promise<StoreConnection> {
  const { auth, firestore } = getFirebaseApp();
  const user = auth.currentUser;
  if (!user) return { platform: null, connected: false };

  // 1) Preferred: users/{uid}/integrations/connection
  const connRef = doc(firestore, 'users', user.uid, 'integrations', 'connection');
  const connSnap = await getDoc(connRef);
  if (connSnap.exists()) {
    const d: any = connSnap.data();
    if (d?.woocommerce?.connected) return { platform: 'woocommerce', connected: true, data: d.woocommerce };
    return { platform: null, connected: false };
  }

  // 2) Alt: users/{uid}/integrations/{platform}
  const wooAltRef = doc(firestore, 'users', user.uid, 'integrations', 'woocommerce');
  const wooAlt = await getDoc(wooAltRef);
  if (wooAlt.exists() && (wooAlt.data() as any)?.connected) {
    return { platform: 'woocommerce', connected: true, data: wooAlt.data() };
  }

  // 3) Legacy: stores/{uid}
  const legacyRef = doc(firestore, 'stores', user.uid);
  const legacy = await getDoc(legacyRef);
  if (legacy.exists()) {
    const d: any = legacy.data();
    const platform: StorePlatform = d?.platform === 'woocommerce' || d?.consumerKey ? 'woocommerce' : null;
    return { platform, connected: !!platform, data: d };
  }

  return { platform: null, connected: false };
}

// Persists a normalized connection document at users/{uid}/integrations/connection
export async function saveConnection(platform: 'woocommerce', data: any) {
  const { auth, firestore } = getFirebaseApp();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const connRef = doc(firestore, 'users', user.uid, 'integrations', 'connection');
  const payload: any = { updatedAt: serverTimestamp() };
  payload[platform] = { ...(data||{}), connected: true, updatedAt: serverTimestamp() };
  await setDoc(connRef, payload, { merge: true });
}


