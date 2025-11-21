import type { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '../../../dashboard/lib/firebaseAdmin';
import { getAdminDb } from '../../../dashboard/lib/firebaseAdminDb';

function getBearer(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  if (Array.isArray(header)) return header[0] ? header[0].replace(/^Bearer\s+/i, '') : null;
  return header.startsWith('Bearer ') ? header.slice(7) : header;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = getBearer(req);
    if (!token) return res.status(200).json({ store: null });
    const decoded = await adminAuth.verifyIdToken(token).catch(() => null);
    if (!decoded) return res.status(200).json({ store: null });
    const uid = decoded.uid;

    const db = getAdminDb();
    const snapshot = await db.ref(`users/${uid}/integrations/shopify`).get();
    let store = snapshot.exists() ? snapshot.val() : null;

    if (store && !store.accessToken) {
      try {
        const mirror = await db.ref(`stores/${uid}_shopify`).get();
        if (mirror.exists()) {
          const data = mirror.val() || {};
          if (data.accessToken) store.accessToken = data.accessToken;
        }
      } catch {
        // ignore mirror fallback errors
      }
    }

    return res.status(200).json({ store });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Internal error' });
  }
}

