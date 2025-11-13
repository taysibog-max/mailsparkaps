import { getFirebaseApp } from '../lib/firebaseClient';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';

export type ImportedContact = {
  email: string;
  firstName?: string;
  lastName?: string;
  source: 'woocommerce' | 'shopify';
  sourceStore?: 'woocommerce' | 'shopify';
  importedAt?: any;
  dateImported?: any;
  createdAt?: string; // ISO string for client-side date display
};

export async function importContactsToFirestore(contacts: ImportedContact[]): Promise<{ created: number; skipped: number; total: number; }>{
  const { auth, firestore } = getFirebaseApp();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const baseCol = collection(firestore, 'users', user.uid, 'contacts');
  let created = 0;
  let skipped = 0;

  for (const c of contacts) {
    const email = (c.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped++; continue; }

    const contactId = email; // stable id: email
    const ref = doc(firestore, 'users', user.uid, 'contacts', contactId);
    const exists = await getDoc(ref);
    if (exists.exists()) { skipped++; continue; }
    await setDoc(ref, {
      email,
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      // Keep legacy fields for backward compatibility
      source: c.source,
      importedAt: serverTimestamp(),
      // New fields per spec
      sourceStore: c.source || c.sourceStore,
      dateImported: serverTimestamp(),
      createdAt: c.createdAt || new Date().toISOString(),
    }, { merge: true });
    created++;
  }

  return { created, skipped, total: created + skipped };
}

export async function fetchAllContacts(): Promise<ImportedContact[]>{
  const { auth, firestore } = getFirebaseApp();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const baseCol = collection(firestore, 'users', user.uid, 'contacts');
  const snap = await getDocs(baseCol);
  const list: ImportedContact[] = [];
  snap.forEach(d=>{ list.push(d.data() as ImportedContact); });
  // newest-ish (serverTimestamp resolves async; order client-side by email for stability)
  list.sort((a,b)=> (a.email || '').localeCompare(b.email || ''));
  return list;
}

