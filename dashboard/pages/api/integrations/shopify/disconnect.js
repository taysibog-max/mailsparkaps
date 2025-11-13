import { adminAuth } from '../../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../../lib/firebaseAdminDb';
import * as admin from 'firebase-admin';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    
    const db = getAdminDb();
    await db.ref(`users/${uid}/integrations/shopify`).remove();
    await db.ref(`stores/${uid}_shopify`).remove();
    // Remove RTDB contacts for Shopify
    try {
      const contactsSnap = await db.ref(`users/${uid}/contacts`).get();
      if (contactsSnap.exists()) {
        const val = contactsSnap.val() || {};
        const updates = {};
        Object.keys(val).forEach(k=>{ if ((val[k]?.sourceStore||val[k]?.source)==='shopify') updates[`users/${uid}/contacts/${k}`] = null; });
        if (Object.keys(updates).length) await db.ref().update(updates);
      }
    } catch(_) {}

    // Remove Firestore contacts for Shopify
    try {
      const fs = admin.firestore();
      const coll = fs.collection('users').doc(uid).collection('contacts');
      const snap = await coll.where('sourceStore','==','shopify').get();
      const batch = fs.batch();
      snap.forEach(d=> batch.delete(coll.doc(d.id)));
      const snap2 = await coll.where('source','==','shopify').get();
      snap2.forEach(d=> batch.delete(coll.doc(d.id)));
      await batch.commit();
    } catch(_) {}
    
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


