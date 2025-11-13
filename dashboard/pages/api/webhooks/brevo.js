import { adminDatabase } from '../../../lib/firebaseAdmin';

// Brevo webhook: expects POST JSON with array or single event.
// We'll handle at least 'open' and 'click' events and increment per-user stats.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body || {};
    const events = Array.isArray(body) ? body : (body.events || [body]);
    for (const ev of events) {
      const e = (ev.event || ev.type || '').toString().toLowerCase();
      const uid = ev?.uid || ev?.metadata?.uid || ev?.payload?.uid;
      const cartId = ev?.cart_id || ev?.metadata?.cart_id || ev?.payload?.cart_id;
      if (!uid) continue;
      if (e.includes('open')) {
        await adminDatabase.ref(`users/${uid}/stats`).transaction((cur)=>{
          const s = cur && typeof cur === 'object' ? cur : {};
          return { ...s, opens: (s.opens||0)+1 };
        });
        if (cartId) await adminDatabase.ref(`users/${uid}/abandoned_carts/${cartId}/engagement`).update({ opened: true, opened_at: Date.now() });
      }
      if (e.includes('click')) {
        await adminDatabase.ref(`users/${uid}/stats`).transaction((cur)=>{
          const s = cur && typeof cur === 'object' ? cur : {};
          return { ...s, clicks: (s.clicks||0)+1 };
        });
        if (cartId) await adminDatabase.ref(`users/${uid}/abandoned_carts/${cartId}/engagement`).update({ clicked: true, clicked_at: Date.now() });
      }
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Webhook error' });
  }
}


