import type { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth, adminDatabase } from '../../../lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).send('not connected');
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return res.status(401).send('not connected');
  }

  try {
    const [integrationSnapshot, directSnapshot] = await Promise.all([
      adminDatabase.ref(`users/${uid}/integrations/shopify`).get(),
      adminDatabase.ref(`users/${uid}/shopify`).get(),
    ]);

    const integrationData = integrationSnapshot.exists() ? integrationSnapshot.val() : null;
    const directData = directSnapshot.exists() ? directSnapshot.val() : null;

    const isConnected = Boolean(
      integrationData?.connected ||
        directData?.connected ||
        integrationData?.accessToken ||
        directData?.accessToken ||
        integrationData?.shopDomain ||
        directData?.shopDomain,
    );

    return res.status(200).send(isConnected ? 'connected' : 'not connected');
  } catch (error) {
    console.error('[Shopify Status] Failed to determine status', error);
    return res.status(500).send('not connected');
  }
}

