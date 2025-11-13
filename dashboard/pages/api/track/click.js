import { adminDatabase } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  try {
    const msgId = String(req.query.m || '');
    const target = String(req.query.u || '');
    const uid = String(req.query.uid || '');
    const cartId = String(req.query.c || '');
    if (msgId) {
      // Update per-user stats if known (no global writes)
      try {
        const now = Date.now();
        if (uid) {
          await adminDatabase.ref(`users/${uid}/stats`).transaction((cur)=>{
            const s = cur && typeof cur === 'object'? cur : {};
            return { ...s, clicks: (s.clicks||0)+1 };
          });
          if (cartId) {
            try { await adminDatabase.ref(`users/${uid}/abandoned_carts/${cartId}/engagement`).update({ clicked: true, clicked_at: now }); } catch(_) {}
          }
        }
      } catch(_) {}
    }
    const dest = target || '/';
    res.writeHead(302, { Location: dest });
    res.end();
  } catch (e) {
    res.writeHead(302, { Location: '/' });
    res.end();
  }
}


