import { adminDb as firestore, adminAuth } from '../../../lib/firebaseAdmin';

export default async function handler(req, res){
  try {
    // Scope by user
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const u = await adminAuth.verifyIdToken(token);
    const uid = u.uid;

    const snap = await firestore.collection('users').doc(uid).collection('events').get();
    const counts = {};
    snap.forEach(d=>{
      const t = d.data().type;
      counts[t] = (counts[t]||0)+1;
    });
    res.status(200).json({ counts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


