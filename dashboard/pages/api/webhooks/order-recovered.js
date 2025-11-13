import { adminDatabase } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    // Expected body: { cart_id, order_id, revenue, uid }
    const { cart_id, revenue, uid } = req.body || {};
    if (!cart_id) return res.status(400).json({ error: 'cart_id required' });
    // Increment recovered and set cart status under user only
    if (uid) {
      try {
        await adminDatabase.ref(`users/${uid}/stats`).transaction((cur) => {
          const s = cur && typeof cur === 'object' ? cur : {};
          return { ...s, recovered: (s.recovered || 0) + 1 };
        });
        await adminDatabase.ref(`users/${uid}/abandoned_carts/${cart_id}`).update({ status: 'recovered', revenue: revenue || 0 });
        // Append event
        const ts = Date.now();
        await adminDatabase.ref(`users/${uid}/events/${ts}`).set({ type: 'order_recovered', cart_id, revenue: revenue || 0 });
      } catch(_) {}
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


