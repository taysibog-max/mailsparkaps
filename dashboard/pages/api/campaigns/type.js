import { adminDb as firestore, adminAuth } from '../../../lib/firebaseAdmin';

export default async function handler(req, res){
  try {
    const { type } = req.query;
    if (!type) return res.status(400).json({ error: 'Missing type' });

    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const u = await adminAuth.verifyIdToken(token);
    const uid = u.uid;

    const evSnap = await firestore.collection('users').doc(uid).collection('events').where('type','==',String(type)).orderBy('createdAt','desc').limit(200).get();
    const events = [];
    evSnap.forEach(d=> events.push({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt }));

    let config = null;
    const cfgSnap = await firestore.collection('campaigns').where('type','==',String(type)).where('userId','==',uid).limit(1).get();
    cfgSnap.forEach(d=> config = d.data());

    res.status(200).json({ events, config });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


