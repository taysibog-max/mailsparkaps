// Minimal placeholder: in real app set SHOPIFY_CLIENT_ID/SECRET and implement OAuth
import { getAdminDb } from '../../../../lib/firebaseAdminDb';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { userId, accessToken, shop } = req.body || {};
    if (!userId || !accessToken || !shop) return res.status(400).json({ error: 'Missing fields' });
    const db = getAdminDb();
    await db.ref(`stores/${userId}_shopify_${shop}`).set({ type: 'shopify', shop, accessToken, userId });
    // also mirror into users doc for easy lookup
    try { await db.ref(`users/${userId}/connectedStores/shopify`).set({ shop, accessToken }); } catch (_) {}
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}


