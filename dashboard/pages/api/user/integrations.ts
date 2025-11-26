import type { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';

function sanitizeIntegration<T extends Record<string, any>>(data: T | null | undefined): T | null {
  if (!data || typeof data !== 'object') return null;
  const { accessToken, token, secret, consumerSecret, ...rest } = data;
  return rest as T;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const snapshot = await adminDatabase.ref(`users/${uid}/integrations`).get();
    const rawIntegrations = snapshot.exists() ? snapshot.val() : {};

    const integrations: Record<string, any> = {};
    Object.entries(rawIntegrations || {}).forEach(([key, value]) => {
      integrations[key] = sanitizeIntegration(value as Record<string, any>);
    });

    return res.status(200).json({
      integrations,
      woocommerce: integrations?.woocommerce ?? null,
    });
  } catch (error) {
    console.error('[User Integrations] Failed to load integrations', error);
    return res.status(500).json({ error: 'Failed to load integrations' });
  }
}

