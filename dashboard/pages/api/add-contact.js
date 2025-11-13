import { adminAuth, adminDb as firestore } from '../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req, res) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });

    const contactRef = firestore.collection('users').doc(uid).collection('contacts').doc(email.toLowerCase());
    await contactRef.set({
      email: email.toLowerCase(),
      firstName: '',
      lastName: '',
      source: 'manual',
      createdAt: new Date().toISOString(),
      importedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}


