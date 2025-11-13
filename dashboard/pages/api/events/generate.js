import { adminDb as firestore, adminAuth } from '../../../lib/firebaseAdmin';
import { getAdminDb } from '../../../lib/firebaseAdminDb';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const u = await adminAuth.verifyIdToken(token);
    const uid = u.uid;

    const { count = 5 } = req.body || {};
    const types = ['abandoned_cart','welcome_email','post_purchase','review_request','reactivation'];
    const db = getAdminDb();

    const batch = firestore.batch();
    const now = Date.now();
    const created = [];
    for (let i=0;i<count;i++){
      const t = types[i % types.length];
      const email = `test${i}@example.com`;
      const fsRef = firestore.collection('users').doc(uid).collection('events').doc();
      const doc = { type: t, email, storeId: 'dev', userId: uid, data: { test: true }, createdAt: new Date(now+i*1000), processed: false, source: 'dev' };
      batch.set(fsRef, doc);
      created.push(doc);
    }
    await batch.commit();

    // RTDB mirror for visibility
    const updates = {};
    created.forEach((ev,idx)=>{
      const key = `${now+idx}`;
      updates[`users/${uid}/events/${key}`] = { ...ev, createdAt: now+idx };
    });
    if (Object.keys(updates).length) await db.ref().update(updates);

    res.status(200).json({ ok: true, added: created.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}



