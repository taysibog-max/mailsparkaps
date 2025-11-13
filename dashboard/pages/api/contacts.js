import { adminAuth, adminDb as firestore } from '../../lib/firebaseAdmin';
import { getAdminDb } from '../../lib/firebaseAdminDb';

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    let uid = null;
    if (token) {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
    } else if (process.env.NODE_ENV !== 'production') {
      // Dev fallback: allow X-User-Uid when offline/no token so Contacts can load locally
      uid = req.headers['x-user-uid'] || null;
    }
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    // 1) Try Realtime Database first: users/{uid}/contacts
    try {
      const db = getAdminDb();
      const snap = await db.ref(`users/${uid}/contacts`).get();
      if (snap.exists()) {
        const val = snap.val() || {};
        const list = Object.values(val).filter(Boolean);
        list.sort((a,b)=> (a.email||'').localeCompare(b.email||''));
        return res.status(200).json({ contacts: list });
      }
    } catch (_) {
      // ignore and fallback to Firestore
    }

    // 2) Fallback to Firestore if RTDB is empty/unavailable
    try {
      const contactsRef = firestore.collection('users').doc(uid).collection('contacts');
      const snapshot = await contactsRef.get();
      const contacts = [];
      snapshot.forEach(doc => { contacts.push(doc.data()); });
      contacts.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
      return res.status(200).json({ contacts });
    } catch (e) {
      return res.status(200).json({ contacts: [] });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}


