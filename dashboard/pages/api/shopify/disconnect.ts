import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from '../../../lib/firestoreAdmin';
import { requireUser } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { uid } = await requireUser(req);
    const { storeId } = req.body || {};
    if (!storeId) return res.status(400).json({ error: 'Missing storeId' });
    const db = getFirestore();
    const ref = db.collection('shopifyConnections').doc(storeId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Store not found' });
    const data = doc.data() as any;
    if (data.userId !== uid) return res.status(403).json({ error: 'Forbidden' });

    await ref.set({ active: false, accessToken: '', disconnectedAt: new Date() }, { merge: true });
    return res.status(200).json({ success: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return res.status(status).json({ error: e?.message || 'Internal error' });
  }
}




