import { adminDatabase } from '../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  try {
    const msgId = String(req.query.m || '');
    const uid = String(req.query.uid || '');
    const cartId = String(req.query.c || '');
    if (msgId) {
      // Increment global opens
      await adminDatabase.ref('stats/global').transaction((cur)=>{
        const s = cur && typeof cur === 'object'? cur : {};
        return { ...s, opens: (s.opens||0)+1 };
      });

      // Update per-user stats if known (no global writes)
      try {
        const now = Date.now();
        if (uid) {
          await adminDatabase.ref(`users/${uid}/stats`).transaction((cur)=>{
            const s = cur && typeof cur === 'object'? cur : {};
            return { ...s, opens: (s.opens||0)+1 };
          });
          if (cartId) {
            try { await adminDatabase.ref(`users/${uid}/abandoned_carts/${cartId}/engagement`).update({ opened: true, opened_at: now }); } catch(_) {}
          }
        }
      } catch(_) {}
    }
  } catch(_) {}
  // Return 1x1 transparent gif
  const gif = Buffer.from('R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==','base64');
  res.setHeader('Content-Type','image/gif');
  res.setHeader('Cache-Control','no-store, must-revalidate');
  res.status(200).send(gif);
}


