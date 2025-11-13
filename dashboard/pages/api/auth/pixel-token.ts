import type { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '../../../lib/firebaseAdmin';
import crypto from 'crypto';

function signToken(uid: string, secret: string): string {
  const base = Buffer.from(uid, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(base).digest('base64url');
  return `${base}.${sig}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Missing idToken' });

    // Verify Firebase ID token
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const secret = process.env.SERVER_JWT_SECRET || 'dev_local_secret_change_me';
    const token = signToken(uid, secret);

    return res.status(200).json({ token, uid });
  } catch (e: any) {
    return res.status(401).json({ error: 'Unauthorized', message: e?.message || String(e) });
  }
}


