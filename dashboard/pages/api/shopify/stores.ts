import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from '../../../lib/firestoreAdmin';
import { requireUser } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { uid } = await requireUser(req);
    const db = getFirestore();
    const snap = await db.collection('shopifyConnections').where('userId', '==', uid).get();
    const stores = snap.docs.map(d => ({ id: d.id, ...(d.data() as any), accessToken: undefined }));
    return res.status(200).json({ stores });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return res.status(status).json({ error: e?.message || 'Internal error' });
  }
}




