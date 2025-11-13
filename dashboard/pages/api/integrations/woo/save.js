import { adminAuth, adminDb } from '../../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const { shopUrl, key, secret } = req.body || {};
    if (!shopUrl || !key || !secret) return res.status(400).json({ error: 'Missing fields' });
    await adminDb.collection('users').doc(uid).set({ connectedStores: { woo: { shopUrl, key, secret } } }, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


